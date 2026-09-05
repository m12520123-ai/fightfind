const DESTINATIONS={
JP:[["NRT","東京成田"],["HND","東京羽田"],["KIX","大阪關西"],["OKA","沖繩"],["FUK","福岡"],["CTS","札幌新千歲"],["NGO","名古屋"],["SDJ","仙台"],["KMJ","熊本"],["KOJ","鹿兒島"],["HIJ","廣島"],["TAK","高松"],["MYJ","松山"],["KMQ","小松"],["OIT","大分"],["NGS","長崎"]],
KR:[["ICN","首爾仁川"],["GMP","首爾金浦"],["PUS","釜山"],["CJU","濟州"],["TAE","大邱"],["CJJ","清州"]],
TH:[["BKK","曼谷蘇凡納布"],["DMK","曼谷廊曼"],["CNX","清邁"],["HKT","普吉"],["KBV","喀比"]],
VN:[["SGN","胡志明市"],["HAN","河內"],["DAD","峴港"],["PQC","富國島"],["CXR","芽莊"]],
PH:[["MNL","馬尼拉"],["CEB","宿霧"],["CRK","克拉克"],["DVO","達沃"],["PPS","公主港"]],
HK:[["HKG","香港"]],MO:[["MFM","澳門"]],SG:[["SIN","新加坡"]],
MY:[["KUL","吉隆坡"],["PEN","檳城"],["BKI","亞庇"],["JHB","新山"]],
ID:[["DPS","峇里島"],["CGK","雅加達"],["SUB","泗水"]]
};
const ZH_AIRLINES={CI:"中華航空",BR:"長榮航空",IT:"台灣虎航",JX:"星宇航空",MM:"樂桃航空",GK:"捷星日本",JL:"日本航空",NH:"全日空",TR:"酷航",SQ:"新加坡航空",CX:"國泰航空",HX:"香港航空",UO:"香港快運",KE:"大韓航空",OZ:"韓亞航空","7C":"濟州航空",LJ:"真航空",TW:"德威航空",ZE:"易斯達航空",TG:"泰國航空",VZ:"泰越捷",FD:"泰國亞洲航空",VN:"越南航空",VJ:"越捷航空",PR:"菲律賓航空",Z2:"菲律賓亞洲航空","5J":"宿霧太平洋",AK:"亞洲航空",D7:"亞洲航空X",MH:"馬來西亞航空"};
function json(res,status,body){res.status(status).setHeader("Content-Type","application/json; charset=utf-8").send(JSON.stringify(body))}
function aviasalesLink(link){if(!link)return null;if(/^https?:\/\//i.test(link))return link;return `https://www.aviasales.com${link.startsWith("/")?"":"/"}${link}`}
function nameAirline(code,title){return ZH_AIRLINES[code]||title||code||"航空公司"}

async function priceRows({token,origin,destination,date,returnDate,direct}){
 const p=new URLSearchParams({origin,destination,departure_at:date,currency:"twd",sorting:"price",direct:direct?"true":"false",limit:"100",page:"1",unique:"false",one_way:returnDate?"false":"true"});
 if(returnDate)p.set("return_at",returnDate);
 const r=await fetch("https://api.travelpayouts.com/aviasales/v3/prices_for_dates?"+p,{headers:{"Accept":"application/json","X-Access-Token":token}});
 const payload=await r.json().catch(()=>({}));
 if(!r.ok||payload?.success===false)throw new Error(payload?.error||payload?.message||`Travelpayouts API ${r.status}`);
 return (Array.isArray(payload?.data)?payload.data:[]).map(x=>({
  amount:Number(x.price),currency:String(payload.currency||"twd").toUpperCase(),airline:x.airline||"",airlineName:nameAirline(x.airline),
  flightNumber:x.flight_number||"",stops:typeof x.transfers==="number"?x.transfers:null,departAt:x.departure_at||null,arriveAt:null,
  duration:x.duration??null,link:aviasalesLink(x.link),foundAt:x.found_at||null
 }));
}
async function monthCalendar({token,origin,destination,month,direct,city}){
 if(!destination||!month)return null;
 const p=new URLSearchParams({currency:"twd",origin,destination,month:`${month}-01`,show_to_affiliates:"false",one_way:"true",limit:"31"});
 const r=await fetch("https://api.travelpayouts.com/v2/prices/month-matrix?"+p,{headers:{"Accept":"application/json","X-Access-Token":token}});
 const payload=await r.json().catch(()=>({}));
 if(!r.ok||payload?.success===false)return {origin,destination,city,month,days:[]};
 const rows=Array.isArray(payload?.data)?payload.data:[];
 const best=new Map();
 for(const x of rows){
  if(direct&&Number(x.number_of_changes)!==0)continue;
  if(!x.depart_date||!Number.isFinite(Number(x.value)))continue;
  const day=Number(String(x.depart_date).slice(8,10));
  const item={day,amount:Number(x.value),currency:"TWD",stops:Number(x.number_of_changes)||0,foundAt:x.found_at||null};
  if(!best.has(day)||item.amount<best.get(day).amount)best.set(day,item);
 }
 return {origin,destination,city,month,days:[...best.values()].sort((a,b)=>a.day-b.day)};
}
async function specialOffers({token,origin,destinations}){
 try{
  const p=new URLSearchParams({origin,locale:"en",currency:"twd"});
  const r=await fetch("https://api.travelpayouts.com/aviasales/v3/get_special_offers?"+p,{headers:{"Accept":"application/json","X-Access-Token":token}});
  const payload=await r.json().catch(()=>({}));if(!r.ok||payload?.success===false)return [];
  const allowed=new Map(destinations.map(([iata,city])=>[iata,city]));
  return (Array.isArray(payload?.data)?payload.data:[]).filter(x=>allowed.has(x.destination)||allowed.has(x.destination_airport)).map(x=>({amount:Number(x.price),currency:String(payload.currency||"twd").toUpperCase(),airline:x.airline||"",airlineName:nameAirline(x.airline,x.airline_title),destination:x.destination_airport||x.destination,city:allowed.get(x.destination_airport)||allowed.get(x.destination)||x.destination_name||"",departAt:x.departure_at||null,duration:x.duration??null,link:aviasalesLink(x.link)})).sort((a,b)=>a.amount-b.amount).slice(0,8);
 }catch{return []}
}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let i=0;async function worker(){while(true){const n=i++;if(n>=items.length)return;try{out[n]=await fn(items[n])}catch(e){out[n]={error:e.message}}}}await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out}

export default async function handler(req,res){
 if(req.method!=="POST")return json(res,405,{error:"Method not allowed"});
 const token=process.env.TRAVELPAYOUTS_TOKEN;if(!token)return json(res,500,{error:"尚未設定 TRAVELPAYOUTS_TOKEN"});
 const {origin="TPE",country="JP",destination="",date,returnDate="",calendarMonth="",direct=false,budget=0}=req.body||{};
 if(!date)return json(res,400,{error:"請選擇出發日期"});
 const countryList=DESTINATIONS[country];if(!countryList)return json(res,400,{error:"目前尚未支援這個國家"});
 const targets=destination?countryList.filter(([iata])=>iata===destination):countryList;
 if(destination&&!targets.length)return json(res,400,{error:"指定機場不屬於目前選擇的國家"});
 const batches=await mapLimit(targets,4,async([iata,city])=>{
  const rows=await priceRows({token,origin,destination:iata,date,returnDate:returnDate||null,direct});
  const filtered=rows.filter(x=>(!direct||x.stops===0)&&(!budget||x.amount<=Number(budget)));
  if(!filtered.length)return null;
  const byAirline=new Map();
  for(const x of filtered.sort((a,b)=>a.amount-b.amount)){const k=x.airline||x.airlineName;if(!byAirline.has(k))byAirline.set(k,x)}
  const airlineOptions=[...byAirline.values()].sort((a,b)=>a.amount-b.amount).slice(0,8);
  return {...airlineOptions[0],destination:iata,city,airlineOptions};
 });
 const results=batches.filter(x=>x&&!x.error).sort((a,b)=>a.amount-b.amount);
 const errors=batches.filter(x=>x?.error).map(x=>x.error);
 const calTarget=destination?targets[0]:null;
 const [specials,calendar]=await Promise.all([
  specialOffers({token,origin,destinations:targets}),
  calTarget?monthCalendar({token,origin,destination:calTarget[0],city:calTarget[1],month:calendarMonth||String(date).slice(0,7),direct}):Promise.resolve(null)
 ]);
 return json(res,200,{origin,country,destination:destination||null,date,returnDate:returnDate||null,searched:targets.length,results,specials,calendar,warnings:[...new Set(errors)].slice(0,5),source:"Travelpayouts / Aviasales Data API",cachedPriceData:true,generatedAt:new Date().toISOString()});
}