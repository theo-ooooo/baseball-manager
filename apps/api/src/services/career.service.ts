import { BadRequestException, ConflictException, Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CatalogRepository } from '../repositories/catalog.repository';
import { CareerRepository } from '../repositories/career.repository';
import { createGameEngine } from '../domain/game-engine';

@Injectable()
export class CareerService {
  constructor(@Inject(CatalogRepository) private readonly catalog: CatalogRepository, @Inject(CareerRepository) private readonly careers: CareerRepository) {}
  async read(db: D1Database, user: string) {
    const current=await this.careers.read(db,user);
    if(current.state){const world=await this.catalog.getWorld(db);current.state=createGameEngine(world).applyAction(current.state,{type:'syncCatalog'});}
    return current;
  }
  async match(db: D1Database, user: string, id: string) {
    const result = await this.careers.match(db,user,id);
    if (!result) throw new NotFoundException('경기 기록을 찾을 수 없습니다.');
    return result;
  }
  async act(db: D1Database, user: string, action: Record<string, unknown>) {
    const requestId = typeof action.requestId === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(action.requestId) ? action.requestId : crypto.randomUUID();
    if (await this.careers.seenRequest(db,user,requestId)) return this.read(db,user);
    const current = await this.read(db,user);
    const expected = Number(action.revision);
    if (!Number.isInteger(expected) || expected !== current.revision) throw new ConflictException({error:'다른 화면에서 변경됐습니다. 최신 커리어를 불러왔습니다.',...current});
    const world = await this.catalog.getWorld(db), engine = createGameEngine(world);
    let next;
    try {
      if (action.type === 'start') {
        if (current.state && action.replace !== true) throw new Error('기존 커리어 교체를 확인해 주세요.');
        if (!world.clubs.some(c => c.id === action.club)) throw new Error('구단을 선택해 주세요.');
        if (action.mode !== 'short' && action.mode !== 'full') throw new Error('시즌 길이를 선택해 주세요.');
        next = engine.newGame(String(action.club),String(action.manager||'감독'),action.mode,Date.now(),{firstSeasonTransferBan:action.firstSeasonTransferBan===true});
      } else {
        if (!current.state) throw new Error('먼저 커리어를 시작해 주세요.');
        if (action.type === 'advance' && (!Number.isInteger(action.count) || Number(action.count)<1 || Number(action.count)>7)) throw new Error('한 번에 1~7일을 진행할 수 있습니다.');
        next = engine.applyAction(current.state,action);
      }
    } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : '잘못된 요청입니다.'); }
    const saved = await this.careers.save(db,user,expected,current.state,next,world,String(action.type),requestId);
    if (!saved) throw new ConflictException({error:'다른 요청이 먼저 저장됐습니다. 최신 커리어를 불러왔습니다.',...await this.read(db,user)});
    return saved;
  }
}
