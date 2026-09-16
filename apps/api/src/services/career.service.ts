import { recommendTrades } from '../domain/trade-recommendations';
import { matchInboxGate } from '../domain/match-inbox-gate';
import { gameDate } from '@dugout/shared/calendar';
import { createManagerCareer } from '../domain/manager-career';
import { preparePostseason } from '../domain/postseason-calendar';
import { prepareWeather } from '../domain/weather-scheduling';
import { prepareKnowledge } from '../domain/scouting';
import { attachPortraits, presentCareer } from './presentation';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { CatalogRepository } from '../repositories/catalog.repository';
import { CareerRepository } from '../repositories/career.repository';
import { createGameEngine } from '../domain/game-engine';
import { prepareSquad } from '../domain/squad-management';
import { prepareDynamics } from '../domain/club-dynamics';
import { createGameView } from '@dugout/shared/game-view';
import type { GameState, WorldCatalog } from '@dugout/shared/types';
import { freeAgentValuation } from '../domain/free-agent-valuation';

@Injectable()
export class CareerService {
  constructor(
    @Inject(CatalogRepository) private readonly catalog: CatalogRepository,
    @Inject(CareerRepository) private readonly careers: CareerRepository,
  ) {}
  async read(db: D1Database, user: string) {
    const current = await this.careers.read(db, user);
    if (!current.state) return current;
    const world = await this.catalog.getWorld(db);
    prepareWeather(current.state);
    preparePostseason(
      current.state,
      world.clubs.find((club) => club.id === current.state!.club)!.league,
    );
    if (!current.state.liveMatch) {
      // Repository parsing already owns this request's state; do not clone the entire save again.
      createManagerCareer(world).prepare(current.state);
      prepareSquad(current.state, world);
      prepareKnowledge(current.state, world);
      prepareDynamics(current.state);
    }
    // Include old saves with an active match without preparing or changing that match.
    return attachPortraits(current, world);
  }
  async match(db: D1Database, user: string, id: string) {
    const result = await this.careers.match(db, user, id);
    if (!result) throw new NotFoundException('경기 기록을 찾을 수 없습니다.');
    return result;
  }
  private async freeAgentTerms(
    db: D1Database,
    user: string,
    state: GameState,
    world: WorldCatalog,
    id: string,
  ) {
    const view = createGameView(world);
    const p = view.marketPlayers(state).find((p) => p.id === id && p.club === 'fa');
    if (!p) return undefined;
    const previous = await this.careers.lastPlayerSeason(db, user, id);
    return freeAgentValuation(state, p, view.getClub(state.club).league, previous);
  }
  async contractQuote(db: D1Database, user: string, id: string) {
    const [current, world] = await Promise.all([
      this.careers.read(db, user),
      this.catalog.getWorld(db),
    ]);
    if (!current.state || current.state.managerCareer?.status === 'unemployed')
      throw new BadRequestException('소속 구단에서 FA 협상을 시작해 주세요.');
    const terms = await this.freeAgentTerms(db, user, current.state, world, id);
    if (!terms) throw new NotFoundException('현재 자유계약 선수만 요구 조건을 조회할 수 있습니다.');
    return terms;
  }
  async tradeRecommendations(db: D1Database, user: string, input: Record<string, unknown>) {
    const [current, world] = await Promise.all([
      this.careers.read(db, user),
      this.catalog.getWorld(db),
    ]);
    if (!current.state) throw new BadRequestException('먼저 커리어를 시작해 주세요.');
    try {
      const suggestions = recommendTrades(current.state, world, input);
      return {
        revision: current.revision,
        date: gameDate(current.state),
        suggestions,
        message: suggestions.length
          ? '현재 조건에서 구단이 검토할 수 있는 교환안입니다. 선수·현금 조건을 확인한 뒤 제안하세요.'
          : '핵심 선수를 보호하고 예산·선수 구성을 맞출 수 있는 추천안이 없습니다. 받을 선수나 협상 구단을 바꿔 보세요.',
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : '추천 조건을 확인해 주세요.',
      );
    }
  }
  async act(db: D1Database, user: string, action: Record<string, unknown>) {
    const requestId =
      typeof action.requestId === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(action.requestId)
        ? action.requestId
        : crypto.randomUUID();
    // Keep the persisted snapshot as the delta baseline; the engine normalizes its own copy.
    // Catalog lookup and the three bounded career reads have no data dependency.
    const [{ current, seen }, world] = await Promise.all([
      this.careers.actionSnapshot(db, user, requestId),
      this.catalog.getWorld(db),
    ]);
    const refreshed = () => {
      if (current.state) prepareWeather(current.state);
      if (current.state)
        preparePostseason(
          current.state,
          world.clubs.find((club) => club.id === current.state!.club)!.league,
        );
      if (current.state && !current.state.liveMatch) {
        createManagerCareer(world).prepare(current.state);
        prepareSquad(current.state, world);
        prepareKnowledge(current.state, world);
        prepareDynamics(current.state);
      }
      return current;
    };
    if (seen) return attachPortraits(refreshed(), world);
    const expected = Number(action.revision);
    if (!Number.isInteger(expected) || expected !== current.revision)
      throw new ConflictException({
        error: '다른 화면에서 변경됐습니다. 최신 커리어를 불러왔습니다.',
        ...presentCareer(attachPortraits(refreshed(), world)),
      });
    const scoutIds = [
      'advance',
      'continue',
      'continueDay',
      'delegateMatch',
      'completeMatch',
      'skipPreseason',
      'delegateSeriesDay',
    ].includes(String(action.type))
      ? current.state?.scouting?.assignments
          .filter((task) => task.status === 'active')
          .flatMap((task) => task.candidateIds || []) || []
      : [];
    const scoutingSeasons = await this.careers.scoutingSeasons(db, user, scoutIds);
    const engine = createGameEngine(world, scoutingSeasons);
    let next;
    try {
      if (current.state) {
        const inbox = matchInboxGate(
          current.state,
          action,
          action.type === 'continue' && !!createGameView(world).nextFixture(current.state),
        );
        if (inbox) throw new Error(inbox.reason);
      }
      if (action.type === 'start') {
        if (current.state?.liveMatch) throw new Error('진행 중인 경기를 먼저 마쳐 주세요.');
        if (current.state && action.replace !== true)
          throw new Error('기존 커리어 교체를 확인해 주세요.');
        if (!world.clubs.some((c) => c.id === action.club))
          throw new Error('구단을 선택해 주세요.');
        if (action.mode !== 'short' && action.mode !== 'full')
          throw new Error('시즌 길이를 선택해 주세요.');
        // Older clients omit the flag; the career then opens with the four-week preseason.
        if (action.preseason !== undefined && typeof action.preseason !== 'boolean')
          throw new Error('프리시즌 진행 여부를 선택해 주세요.');
        next = engine.newGame(
          String(action.club),
          String(action.manager || ''),
          action.mode,
          Date.now(),
          {
            firstSeasonTransferBan: action.firstSeasonTransferBan === true,
            revealPotential: action.revealPotential === true,
            unemployed: action.unemployed === true,
            preseason: action.preseason !== false,
            challenge: action.challenge as 'chase' | 'rebuild' | undefined,
          },
        );
      } else {
        if (!current.state) throw new Error('먼저 커리어를 시작해 주세요.');
        if (
          action.type === 'advance' &&
          (!Number.isInteger(action.count) || Number(action.count) < 1 || Number(action.count) > 7)
        )
          throw new Error('한 번에 1~7일을 진행할 수 있습니다.');
        const safeAction = { ...action };
        delete safeAction.retiredCandidate;
        delete safeAction.freeAgentTerms;
        if (
          action.type === 'negotiate' ||
          (action.type === 'reviseContractSalary' && action.kind === 'player')
        ) {
          const id =
            action.type === 'negotiate'
              ? String(action.id)
              : current.state.deals.find((d) => d.id === action.id)?.player.id;
          if (id)
            safeAction.freeAgentTerms = await this.freeAgentTerms(
              db,
              user,
              current.state,
              world,
              id,
            );
        }
        if (action.type === 'hireRetiredCoach') {
          const records = await this.careers.playerRecords(db, user, String(action.playerId));
          safeAction.retiredCandidate = records.find((r) => r.kind === 'retirement')?.coach;
        }
        next = engine.applyAction(current.state, safeAction);
      }
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : '잘못된 요청입니다.');
    }
    prepareKnowledge(next, world);
    const saved = await this.careers.save(
      db,
      user,
      expected,
      current.state,
      next,
      world,
      String(action.type),
      requestId,
      current.ledger,
    );
    if (!saved)
      throw new ConflictException({
        error: '다른 요청이 먼저 저장됐습니다. 최신 커리어를 불러왔습니다.',
        ...presentCareer(await this.read(db, user)),
      });
    return attachPortraits(saved, world);
  }
}
