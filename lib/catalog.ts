import imported from './real-rosters.json';
export type League = { id:string; name:string; country:string; flag:string; region:string; label:string; games:number; level:number; source:string; season:string; };
export type Club = {id:string;name:string;short:string;league:string;color:string;city:string;division:string;};
export type RealSeed = {name:string;pos:string;age:number;number?:number;country?:string;rating?:number;source?:string;};
export const leagues:League[] = [
 {id:'kbo',name:'KBO',country:'대한민국',flag:'🇰🇷',region:'아시아',label:'KBO 리그',games:144,level:76,source:'https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx',season:'봄–가을'},
 {id:'mlb',name:'MLB',country:'미국 · 캐나다',flag:'🇺🇸',region:'아메리카',label:'메이저 리그',games:162,level:84,source:'https://www.mlb.com/team',season:'봄–가을'},
 {id:'npb',name:'NPB',country:'일본',flag:'🇯🇵',region:'아시아',label:'일본 프로야구',games:143,level:79,source:'https://npb.jp/eng/teams/',season:'봄–가을'},
 {id:'cpbl',name:'CPBL',country:'대만',flag:'🇹🇼',region:'아시아',label:'중화직업봉구대연맹',games:120,level:69,source:'https://www.cpbl.com.tw/',season:'봄–가을'},
 {id:'lmb',name:'LMB',country:'멕시코',flag:'🇲🇽',region:'아메리카',label:'멕시칸 베이스볼 리그',games:93,level:69,source:'https://lmb.com.mx/equipos',season:'여름 리그'},
 {id:'lmp',name:'LMP',country:'멕시코',flag:'🇲🇽',region:'아메리카',label:'멕시칸 퍼시픽 리그',games:68,level:68,source:'https://www.lmp.mx/',season:'겨울 리그'},
 {id:'abl',name:'ABL',country:'호주',flag:'🇦🇺',region:'오세아니아',label:'호주 베이스볼 리그',games:40,level:61,source:'https://theabl.com.au/about/',season:'남반구 여름'},
 {id:'lidom',name:'LIDOM',country:'도미니카공화국',flag:'🇩🇴',region:'아메리카',label:'도미니칸 윈터 리그',games:50,level:72,source:'https://lidom.com/',season:'겨울 리그'},
 {id:'lvbp',name:'LVBP',country:'베네수엘라',flag:'🇻🇪',region:'아메리카',label:'베네수엘라 프로야구',games:56,level:69,source:'https://stats.lvbp.com/equipos.php',season:'겨울 리그'},
 {id:'lbprc',name:'LBPRC',country:'푸에르토리코',flag:'🇵🇷',region:'아메리카',label:'로베르토 클레멘테 리그',games:40,level:66,source:'https://ligapr.com/',season:'겨울 리그'},
 {id:'honkbal',name:'HOOFDKLASSE',country:'네덜란드',flag:'🇳🇱',region:'유럽',label:'혼크발 후프트클라서',games:36,level:58,source:'https://www.wbsc.org/en/events/baseball-champions-league-europe-2026-finals/news/curacao-neptunus-and-oosterhout-twins-bring-dutch-hoofdklasse-into-the-bcl-europe',season:'봄–가을'},
 {id:'seriea',name:'SERIE A GOLD',country:'이탈리아',flag:'🇮🇹',region:'유럽',label:'세리에 A 골드',games:36,level:59,source:'https://www.fibs.it/en/disciplines/baseball',season:'봄–가을'},
 {id:'extraliga',name:'EXTRALIGA',country:'체코',flag:'🇨🇿',region:'유럽',label:'체코 엑스트랄리가',games:42,level:56,source:'https://extraliga.baseball.cz/',season:'봄–가을'},
];
const rows:Record<string,string[]> = {
 kbo:['lg|LG 트윈스|LG|#e73168|서울','hanwha|한화 이글스|H|#ff7c24|대전','ssg|SSG 랜더스|SSG|#db3e53|인천','samsung|삼성 라이온즈|SL|#4489f5|대구','nc|NC 다이노스|NC|#6dacf1|창원','kt|KT 위즈|KT|#e34f55|수원','lotte|롯데 자이언츠|G|#59addb|부산','kia|KIA 타이거즈|KIA|#ee4055|광주','doosan|두산 베어스|B|#9baedc|서울','kiwoom|키움 히어로즈|KH|#b86b9d|서울'],
 mlb:['orioles|볼티모어 오리올스|BAL|#ff883f|볼티모어|AL 동부','redsox|보스턴 레드삭스|BOS|#e35868|보스턴|AL 동부','yankees|뉴욕 양키스|NYY|#b6c6e6|뉴욕|AL 동부','rays|탬파베이 레이스|TB|#7dbce6|탬파베이|AL 동부','bluejays|토론토 블루제이스|TOR|#458de5|토론토|AL 동부','whitesox|시카고 화이트삭스|CWS|#bbc4cd|시카고|AL 중부','guardians|클리블랜드 가디언스|CLE|#e55e6d|클리블랜드|AL 중부','tigers|디트로이트 타이거스|DET|#f7a059|디트로이트|AL 중부','royals|캔자스시티 로열스|KC|#669df1|캔자스시티|AL 중부','twins|미네소타 트윈스|MIN|#ee6674|미니애폴리스|AL 중부','athletics|애슬레틱스|ATH|#65bf98|새크라멘토|AL 서부','astros|휴스턴 애스트로스|HOU|#ed983c|휴스턴|AL 서부','angels|LA 에인절스|LAA|#ed6478|애너하임|AL 서부','mariners|시애틀 매리너스|SEA|#5ac5c0|시애틀|AL 서부','rangers|텍사스 레인저스|TEX|#759cfa|알링턴|AL 서부','braves|애틀랜타 브레이브스|ATL|#e57678|애틀랜타|NL 동부','marlins|마이애미 말린스|MIA|#5bc5ec|마이애미|NL 동부','mets|뉴욕 메츠|NYM|#fb9a50|뉴욕|NL 동부','phillies|필라델피아 필리스|PHI|#e9656b|필라델피아|NL 동부','nationals|워싱턴 내셔널스|WSH|#dd7187|워싱턴|NL 동부','cubs|시카고 컵스|CHC|#679dfa|시카고|NL 중부','reds|신시내티 레즈|CIN|#e76b73|신시내티|NL 중부','brewers|밀워키 브루어스|MIL|#d6b571|밀워키|NL 중부','pirates|피츠버그 파이리츠|PIT|#ead35b|피츠버그|NL 중부','cardinals|세인트루이스 카디널스|STL|#ee7781|세인트루이스|NL 중부','dbacks|애리조나 다이아몬드백스|ARI|#bba38a|피닉스|NL 서부','rockies|콜로라도 로키스|COL|#ae95e7|덴버|NL 서부','dodgers|LA 다저스|LAD|#669eff|로스앤젤레스|NL 서부','padres|샌디에이고 파드리스|SD|#e2c183|샌디에이고|NL 서부','giants|샌프란시스코 자이언츠|SF|#ff9c66|샌프란시스코|NL 서부'],
 npb:['g|요미우리 자이언츠|YG|#ed994a|도쿄|센트럴','t|한신 타이거스|HT|#e4ce64|니시노미야|센트럴','db|요코하마 DeNA 베이스타스|DB|#67aafa|요코하마|센트럴','c|히로시마 도요 카프|HC|#ed6b75|히로시마|센트럴','s|도쿄 야쿠르트 스왈로스|YS|#74c998|도쿄|센트럴','d|주니치 드래건스|CD|#7daaf6|나고야|센트럴','h|후쿠오카 소프트뱅크 호크스|SH|#ecc35d|후쿠오카|퍼시픽','f|홋카이도 닛폰햄 파이터스|F|#6dcbdc|기타히로시마|퍼시픽','m|지바 롯데 마린스|M|#c5ced6|지바|퍼시픽','e|도호쿠 라쿠텐 골든이글스|E|#d78698|센다이|퍼시픽','b|오릭스 버펄로스|B|#b6b1d9|오사카|퍼시픽','l|사이타마 세이부 라이온스|L|#8bc1dd|도코로자와|퍼시픽'],
 cpbl:['brothers|중신 브라더스|CTB','lions|퉁이 라이온스|UL','monkeys|라쿠텐 몽키스|RM','guardians|푸방 가디언스|FG','dragons|웨이취안 드래건스|WD','hawks|타이강 호크스|TSG'],
 lmb:['diablos|디아블로스 로호스 델 멕시코|MEX','monterrey|술타네스 데 몬테레이|MTY','tijuana|토로스 데 티후아나|TIJ','yucatan|레오네스 데 유카탄|YUC','puebla|페리코스 데 푸에블라|PUE','monclova|아세레로스 데 몬클로바|MVA','laguna|알고도네로스 우니온 라구나|LAG','jalisco|차로스 데 할리스코|JAL','saltillo|사라페로스 데 살티요|SAL','aguascalientes|리엘레로스 데 아과스칼리엔테스|AGS','chihuahua|도라도스 데 치와와|CHI','durango|칼리엔테 데 두랑고|DGO','veracruz|엘 아길라 데 베라크루스|VER','oaxaca|게레로스 데 오아하카|OAX','quintana|티그레스 데 킨타나로오|QRO','tabasco|올메카스 데 타바스코|TAB','campeche|피라타스 데 캄페체|CAM','leon|브라보스 데 레온|LEO','queretaro|콘스피라도레스 데 케레타로|QROO','doslaredos|테콜로테스 데 로스 도스 라레도스|LAR'],
 lmp:['culiacan|토마테로스 데 쿨리아칸|CUL','hermosillo|나란헤로스 데 에르모시요|HER','obregon|야키스 데 오브레곤|OBR','mochis|카녜로스 데 로스 모치스|MOC','mazatlan|베나도스 데 마사틀란|MAZ','jalisco|차로스 데 할리스코|JAL','mexicali|아길라스 데 멕시칼리|MXL','guasave|알고도네로스 데 과사베|GSV','nayarit|하과레스 데 나야리트|NAY','tucson|투손 베이스볼 팀|TUC'],
 abl:['adelaide|애들레이드 자이언츠|ADL','brisbane|브리즈번 밴디츠|BRI','perth|퍼스 히트|PER','sydney|시드니 블루삭스|SYD'],
 lidom:['licey|티그레스 델 리세이|LICEY','aguilas|아길라스 시바에냐스|AC','escogido|레오네스 델 에스코히도|LE','estrellas|에스트레야스 오리엔탈레스|EO','toros|토로스 델 에스테|TE','gigantes|히간테스 델 시바오|GC'],
 lvbp:['caracas|레오네스 델 카라카스|CAR','magallanes|나베간테스 델 마가야네스|MAG','lara|카르데날레스 데 라라|LAR','laguaira|티부로네스 데 라과이라|LG','zulia|아길라스 델 술리아|ZUL','aragua|티그레스 데 아라과|ARA','anzoategui|카리베스 데 안소아테기|ANZ','margarita|브라보스 데 마르가리타|MAR'],
 lbprc:['santurce|캉그레헤로스 데 산투르세|SAN','caguas|크리오요스 데 카과스|CAG','mayaguez|인디오스 데 마야궤스|MAY','carolina|히간테스 데 카롤리나|CAR','ponce|레오네스 데 폰세|PON','sanjuan|세나도레스 데 산후안|SJ'],
 honkbal:['neptunus|퀴라소 넵투누스|NEP','twins|오스터하우트 트윈스|TWI','pirates|암스테르담 파이리츠|AMS','hcaw|HCAW|HCAW','kinheim|킨하임|KIN','pioniers|후프트도르프 피오니어스|PIO','runners|UVV|UVV'],
 seriea:['parma|파르마 베이스볼|PAR','nettuno|네투노 베이스볼|NET','bologna|포르티투도 볼로냐|BOL','grosseto|BBC 그로세토|GRO','macerata|마체라타 엔젤스|MAC','sanmarino|산마리노 베이스볼|SM','reggio|레조 에밀리아|REG','collecchio|콜레키오 베이스볼|COL','ronchi|론키 데이 레조나리|RON','verona|베로나 베이스볼|VER'],
 extraliga:['draci|드라치 브르노|DRB','eagles|이글스 프라하|EP','hrosi|흐로시 브르노|HRB','arrows|애로스 오스트라바|ARR','kotlarka|코틀라르카 프라하|KOT','trebic|트르제비치 뉴클리어스|TRB','hluboka|흘루보카 BSC|HLU','sabat|사바트 프라하|SAB'],
};
const colors=['#83c7f2','#eda357','#bf9be8','#74cfb8','#e48296','#ddc36d'];
export const clubs:Club[] = leagues.flatMap(l=>(rows[l.id]||[]).map((row,i)=>{const [slug,name,short,color,city,division]=row.split('|');return {id:`${l.id}-${slug}`,name,short,color:color||colors[i%colors.length],city:city||l.country,division:division||l.name,league:l.id};}));
export const getClub=(id:string)=>clubs.find(c=>c.id===id)!;
export const getLeague=(id:string)=>leagues.find(l=>l.id===id)!;
export const realRosters=imported as Record<string,RealSeed[]>;
export const rosterNote='2026 공개 로스터를 바탕으로 한 실명 선수와 가상 선수의 혼합 DB입니다. 전체 공식 로스터의 완전한 복제는 아니며, 능력치·잠재력·계약·세부 수비 배치는 게임용 설정입니다.';
