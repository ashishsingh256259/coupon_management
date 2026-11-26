export const normalizeCode = value => String(value ?? '').trim().toUpperCase();
const codePattern = /^[A-Z0-9_-]{3,32}$/;
const validNumber = (n,min,max) => Number.isSafeInteger(n) && n>=min && n<=max;
export function initialState() {
 const coupons=Object.create(null);
 for(const [code,discount,limit,minOrder,expired] of [['SAVE20',20,5,0,false],['NEW50',50,2,200,false],['FLASH10',10,10,0,false],['DEAL30',30,3,500,true],['OFF15',15,1,0,false],['VIP40',40,3,1000,false]]) coupons[code]={discount,limit,minOrder,expired,used:0};
 return {coupons,stack:[],queue:[],head:0,log:[],order:1500};
}
export function hashCode(code,size=101){let sum=0;for(let i=0;i<code.length;i++)sum+=code.charCodeAt(i);return sum%size;}
export const totalDiscount = state => state.stack.reduce((sum,x)=>sum+x.discount,0);
export const savings = state => Math.round(state.order*totalDiscount(state)/100*100)/100;
export const waiting = state => state.queue.slice(state.head);
export function status(c){return c.expired?'Expired':c.used>=c.limit?'Limit reached':'Active';}
export function transition(state,action){
 const fail=message=>({state,ok:false,message});
 const next={...state,coupons:Object.assign(Object.create(null),state.coupons),stack:[...state.stack],queue:[...state.queue],log:[...state.log]};
 const done=(message,type='system')=>{next.log=[{type,message,time:new Date().toISOString()},...next.log].slice(0,50);return{state:next,ok:true,message};};
 const code=normalizeCode(action.code);const record=Object.hasOwn(next.coupons,code)?next.coupons[code]:null;
 switch(action.type){
 case 'order': {
  const amount=Number(action.amount);if(action.amount===''||!Number.isFinite(amount)||amount<0||amount>1e7||Math.abs(amount*100-Math.round(amount*100))>0.00001)return fail('Enter a valid order amount (up to ₹1 crore, two decimals).');
  if(next.stack.some(x=>amount<next.coupons[x.code].minOrder))return fail('Undo coupons with unmet minimum order before reducing this amount.');
  next.order=amount;return done('Order amount updated.');
 }
 case 'apply':
  if(!codePattern.test(code))return fail('Enter a valid coupon code (3–32 letters, numbers, underscores or hyphens).');
  if(!record)return fail('Coupon not found.');
  if(record.expired)return fail('This coupon has expired.');
  if(record.used>=record.limit)return fail('Usage limit reached.');
  if(next.stack.some(x=>x.code===code))return fail('Coupon is already applied.');
  if(next.order<record.minOrder)return fail('Minimum order: ₹'+record.minOrder+'.');
  if(totalDiscount(next)+record.discount>100)return fail('Combined discount cannot exceed 100%.');
  next.coupons[code]={...record,used:record.used+1};next.stack.push({code,discount:record.discount});return done(code+' applied · '+record.discount+'% off','apply');
 case 'undo': {
  const top=next.stack.pop();if(!top)return fail('Nothing to undo.');
  const c=next.coupons[top.code];next.coupons[top.code]={...c,used:c.used-1};return done(top.code+' removed from stack','undo');
 }
 case 'clear':
  if(!next.stack.length)return fail('No coupons applied.');
  for(const item of next.stack){const c=next.coupons[item.code];next.coupons[item.code]={...c,used:c.used-1};}
  next.stack=[];return done('Session cleared','undo');
 case 'add': {
  const discount=Number(action.discount),limit=Number(action.limit),minOrder=Number(action.minOrder??0);
  if(!codePattern.test(code))return fail('Code must have 3–32 letters, numbers, underscores or hyphens.');
  if(record)return fail('Coupon already exists.');
  if(!validNumber(discount,1,100)||!validNumber(limit,1,1000000)||!validNumber(minOrder,0,10000000))return fail('Enter valid whole-number discount, usage limit and minimum order.');
  next.coupons[code]={discount,limit,minOrder,expired:!action.active,used:0};return done(code+' created','admin');
 }
 case 'toggle':
  if(!record)return fail('Coupon not found.');
  next.coupons[code]={...record,expired:!record.expired};return done(code+(record.expired?' activated':' expired'),'admin');
 case 'delete':
  if(!record)return fail('Coupon not found.');
  if(next.stack.some(x=>x.code===code))return fail('Undo this applied coupon before deleting it.');
  delete next.coupons[code];return done(code+' deleted','admin');
 case 'enqueue': {
  const user=String(action.user??'').trim();
  if(!user||user.length>64)return fail('Enter a user ID of 1–64 characters.');
  if(waiting(next).includes(user))return fail('User already waiting.');
  next.queue.push(user);return done(user+' joined queue','queue');
 }
 case 'dequeue': {
  if(next.head>=next.queue.length)return fail('Queue is empty.');
  const user=next.queue[next.head++];if(next.head>=64&&next.head*2>=next.queue.length){next.queue=next.queue.slice(next.head);next.head=0;}
  return done(user+' served','queue');
 }
 case 'clearLog':return{state:{...next,log:[]},ok:true,message:'Activity cleared.'};
 case 'reset':return{state:initialState(),ok:true,message:'Demo reset.'};
 default:return fail('Unknown action.');
 }
}
export function restore(raw){
 try{
 const s=JSON.parse(raw);
 if(!s||!s.coupons||typeof s.coupons!=='object'||Array.isArray(s.coupons)||!Array.isArray(s.stack)||!Array.isArray(s.queue)||!Array.isArray(s.log)||!validNumber(s.head,0,s.queue.length)||!Number.isFinite(s.order)||s.order<0||s.order>1e7)return initialState();
 const coupons=Object.create(null);
 for(const [code,c] of Object.entries(s.coupons)){
 if(!codePattern.test(code)||!c||!validNumber(c.discount,1,100)||!validNumber(c.limit,1,1000000)||!validNumber(c.used,0,c.limit)||!validNumber(c.minOrder,0,1e7)||typeof c.expired!=='boolean')return initialState();
 coupons[code]={...c};
 }
 const seen=new Set();
 for(const x of s.stack){if(!x||!Object.hasOwn(coupons,x.code)||seen.has(x.code)||x.discount!==coupons[x.code].discount||coupons[x.code].used<1||s.order<coupons[x.code].minOrder)return initialState();seen.add(x.code);}
 if(totalDiscount(s)>100||s.queue.some(u=>typeof u!=='string'||u.length>64)||s.log.some(x=>!x||typeof x.message!=='string'||typeof x.time!=='string'||typeof x.type!=='string'))return initialState();
 return {...s,coupons,log:s.log.slice(0,50)};
 }catch{return initialState();}
}
