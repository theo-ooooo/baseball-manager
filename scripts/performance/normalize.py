from pathlib import Path
import sys,json,unicodedata
from table_parser import Parse
root=Path(sys.argv[1]);out=[]
def val(x):
 try:return float(x)
 except:return 0

def ip(s):
 s=str(s).strip().replace('⅓',' 1/3').replace('⅔',' 2/3');parts=s.split();whole=val(parts[0]) if parts else 0
 if parts and '/' in parts[0]:return int(parts[0][0])
 if '.' in str(parts[0]):a,b=parts[0].split('.');return int(a)*3+int(b[:1])
 return int(whole)*3+(int(parts[1][0]) if len(parts)>1 else 0)
for kind,path in [('bat',str(root/'mlb-hitting.json')),('pitch',str(root/'mlb-pitching.json'))]:
 rows=json.loads(Path(path).read_text())['stats'][0]['splits'];seen=set()
 for x in rows:
  ident=x['player']['id']
  if ident in seen:continue
  # API splits already aggregate all teams in one season (numTeams recorded).
  seen.add(ident);s=x['stat'];d={'name':x['player']['fullName'],'officialId':str(ident),'league':'mlb','season':2025,'kind':kind,'source':f'https://statsapi.mlb.com/api/v1/people/{ident}/stats?stats=yearByYear&group='+('hitting' if kind=='bat' else 'pitching')}
  if kind=='bat':d.update(pa=s['plateAppearances'],ab=s['atBats'],h=s['hits'],hr=s['homeRuns'],tb=s['totalBases'],bb=s['baseOnBalls'],k=s['strikeOuts'],sb=s['stolenBases'],g=s['gamesPlayed'])
  else:d.update(outs=ip(s['inningsPitched']),er=s['earnedRuns'],h=s['hits'],hr=s['homeRuns'],bb=s['baseOnBalls'],k=s['strikeOuts'],g=s['gamesPlayed'])
  out.append(d)
for p in root.glob('npb-?-*.html'):
 kind='bat' if p.name[4]=='b' else 'pitch';rows=Parse(p.read_text()).rows;head=next(r for r in rows if 'Player' in r or 'Pitcher' in r)
 for r in rows:
  if len(r)!=len(head) or ',' not in r[1]:continue
  name=' '.join(reversed(r[1].split(', ')));d={'name':name,'league':'npb','club':'npb-'+p.stem.split('-')[-1],'season':2025,'kind':kind,'source':'https://npb.jp/bis/eng/2025/stats/id'+('b' if kind=='bat' else 'p')+'1_'+p.stem.split('-')[-1]+'.html'}
  h=dict(zip(head,r))
  if kind=='bat':d.update({k:val(h[c]) for k,c in {'pa':'PA','ab':'AB','h':'H','hr':'HR','tb':'TB','bb':'BB','k':'SO','sb':'SB','g':'G'}.items()})
  else:d.update(outs=ip(r[11]+r[12]),**{k:val(h[c]) for k,c in {'er':'ER','h':'H','hr':'HR','bb':'BB','k':'SO','g':'G'}.items()})
  out.append(d)
for kind,f in [('bat','HitterBasic.json'),('pitch','PitcherBasic.json')]:
 p=root/f
 if not p.exists():continue
 data=json.loads(p.read_text());head=data['headers']
 for r in data['rows']:
  if len(r)!=len(head):continue
  h=dict(zip(head,r));d={'name':h['선수명'],'league':'kbo','season':2025,'kind':kind,'source':data['source'],'team':h['팀명']}
  if kind=='bat':d.update({k:val(h[c]) for k,c in {'pa':'PA','ab':'AB','h':'H','hr':'HR','tb':'TB','g':'G'}.items()})
  else:d.update(outs=ip(h['IP']),**{k:val(h[c]) for k,c in {'er':'ER','h':'H','hr':'HR','bb':'BB','k':'SO','g':'G'}.items()})
  out.append(d)
# Traded NPB players appear on multiple team pages; add disjoint stint counting stats.
merged={}
for d in out:
 key=(d['league'],d['name'],d['kind'])
 if key in merged and d['league']=='npb':
  old=merged[key]
  for k,v in d.items():
   if isinstance(v,(float,int)) and k not in ['season']:old[k]=old.get(k,0)+v
 else:
  if key in merged:d['ambiguous']=True;merged[key]['ambiguous']=True;outkey=(*key,len(merged));merged[outkey]=d
  else:merged[key]=d
Path(sys.argv[2]).write_text(json.dumps({'asOf':'2026-09-08','season':2025,'records':list(merged.values())},ensure_ascii=False,separators=(',',':'))+'\n')
print({l:len([d for d in merged.values() if d['league']==l]) for l in ['kbo','mlb','npb']})
