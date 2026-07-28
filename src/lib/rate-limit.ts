const buckets=new Map<string,{count:number;reset:number}>();
const MAX_BUCKETS=10_000;
function prune(now:number){for(const[key,value]of buckets){if(value.reset<now)buckets.delete(key)}while(buckets.size>=MAX_BUCKETS){const oldest=buckets.keys().next().value;if(oldest===undefined)break;buckets.delete(oldest)}}
export function rateLimit(key:string,limit=8,windowMs=60_000){const now=Date.now();const b=buckets.get(key);if(!b||b.reset<now){if(buckets.size>=MAX_BUCKETS)prune(now);buckets.set(key,{count:1,reset:now+windowMs});return{allowed:true,retryAfter:0}}b.count++;return{allowed:b.count<=limit,retryAfter:Math.ceil((b.reset-now)/1000)}}

export function clearRateLimitsForTests(){buckets.clear()}
