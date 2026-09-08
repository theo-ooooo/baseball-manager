import json,sys
from pathlib import Path
from table_parser import Parse
root=Path(sys.argv[1]);file=Path(sys.argv[2]);data=json.loads(file.read_text())
lookup={}
for f,cols in [('HitterBasicAdvanced.json',{'bb':'BB','hbp':'HBP','k':'SO','gdp':'GDP','obp':'OBP','slg':'SLG'}),('Runner2025.json',{'sb':'SB','cs':'CS'}),('PitcherBasic.json',{'sv':'SV','hld':'HLD'})]:
 d=json.loads((root/f).read_text())
 for row in d['rows']:
  h=dict(zip(d['headers'],row));key=(h.get('선수명'),h.get('팀명'),'pitch' if 'Pitcher' in f else 'bat');v=lookup.setdefault(key,{})
  for k,c in cols.items():
   try:v[k]=float(h[c])
   except (KeyError,ValueError):pass
for kind,path in [('bat',root/'mlb-hitting.json'),('pitch',root/'mlb-pitching.json')]:
 for x in json.loads(path.read_text())['stats'][0]['splits']:
  st=x['stat'];lookup[('mlb',str(x['player']['id']),kind)]={k:float(st[c]) for k,c in ({'cs':'caughtStealing','hbp':'hitByPitch','sf':'sacFlies','gdp':'groundIntoDoublePlay','obp':'obp','slg':'slg'} if kind=='bat' else {'gs':'gamesStarted','sv':'saves','hld':'holds'}).items() if c in st}
npb={}
for p in root.glob('npb-?-*.html'):
 kind='bat' if p.name[4]=='b' else 'pitch';rows=Parse(p.read_text()).rows;head=next(r for r in rows if 'Player' in r or 'Pitcher' in r)
 for row in rows:
  if len(row)!=len(head) or ',' not in row[1]:continue
  h=dict(zip(head,row));name=' '.join(reversed(row[1].split(', ')));v=npb.setdefault((name,kind),{})
  for k,c in ({'cs':'CS','hbp':'HP','sf':'SF','gdp':'GDP'} if kind=='bat' else {'sv':'SV','hld':'HLD'}).items():
   try:v[k]=v.get(k,0)+float(h[c])
   except (KeyError,ValueError):pass
for r in data['records']:
 if r.get('ambiguous'):continue
 if r['league']=='kbo':r.update(lookup.get((r['name'],r.get('team'),r['kind']),{}))
 elif r['league']=='mlb':r.update(lookup.get(('mlb',r['officialId'],r['kind']),{}))
 else:r.update(npb.get((r['name'],r['kind']),{}))
file.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
print([r for r in data['records'] if r['name']=='유강남'])
