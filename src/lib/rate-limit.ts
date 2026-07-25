const buckets=new Map<string,{count:number;reset:number}>();
export function rateLimit(key:string,limit=8,windowMs=60_000){const now=Date.now();const b=buckets.get(key);if(!b||b.reset<now){buckets.set(key,{count:1,reset:now+windowMs});return{allowed:true,retryAfter:0}}b.count++;return{allowed:b.count<=limit,retryAfter:Math.ceil((b.reset-now)/1000)}}
