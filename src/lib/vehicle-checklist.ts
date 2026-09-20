import {z} from "zod";
export const CHECKLIST_VERSION="FLOWER-1";
export const DECLARATION="I confirm that I completed this check and that the information recorded is accurate to the best of my knowledge.";
export const equipmentKeys=["spare","wheelchair","extinguisher","highVis","triangle","clientEquipment"] as const;
export const vehicleConfigSchema=z.object({spare:z.boolean().default(false),wheelchair:z.boolean().default(false),extinguisher:z.boolean().default(false),highVis:z.boolean().default(true),triangle:z.boolean().default(false),clientEquipment:z.boolean().default(false),stopUse:z.array(z.string().max(80)).max(80).default([])});
export type VehicleConfig=z.infer<typeof vehicleConfigSchema>;
export type Item={key:string;label:string;applicable:boolean;stopUse:boolean};
export function checklist(fuelType:string,raw:unknown){
 const c=vehicleConfigSchema.parse(raw),electric=fuelType==="ELECTRIC";
 const item=(key:string,label:string,applicable=true):Item=>({key,label,applicable,stopUse:c.stopUse.includes(key)});
 return [
 {title:"Fuel, oil & fluids",items:[item("fuel",electric?"Battery charge is adequate":"Fuel is adequate"),item("oil","Engine oil level / warning status is normal",!electric),item("coolant","Coolant level / warning status is normal"),item("screenwash","Screenwash level is adequate"),item("leaks","No visible fluid leaks")]},
 {title:"Lights & electrics",items:[item("headlights","Headlights and sidelights work"),item("indicators","Indicators and hazard lights work"),item("brakeLights","Brake lights work"),item("reverseLights","Rear / reversing lights work"),item("plateLights","Number-plate lights work"),item("warnings","No unexpected dashboard warnings"),item("horn","Horn operates correctly")]},
 {title:"Tyres & wheels",items:[...["Front left","Front right","Rear left","Rear right","Spare"].flatMap((position,i)=>[item(`wheel${i}-inflation`,`${position}: appears correctly inflated`,i!==4||c.spare),item(`wheel${i}-damage`,`${position}: no cuts, bulges, exposed cord or serious damage`,i!==4||c.spare),item(`wheel${i}-tread`,`${position}: tread appears serviceable / legal`,i!==4||c.spare),item(`wheel${i}-secure`,`${position}: wheel and visible fixings appear secure and undamaged`,i!==4||c.spare)])]},
 {title:"Visibility & identification",items:[item("windscreen","Windscreen is clean, clear and without unsafe damage"),item("windows","Side and rear windows are serviceable"),item("mirrors","Mirrors / cameras are secure, clean and usable"),item("wipers","Wipers work and blades appear serviceable"),item("washers","Washers operate correctly"),item("plates","Front and rear plates are secure, present and readable")]},
 {title:"Controls & accessibility",items:[item("steering","Steering operates normally"),item("brakes","Foot brake operates normally"),item("parkingBrake","Parking brake operates normally"),item("seatbelts","Seatbelts are present and serviceable"),item("doors","Doors, bonnet and boot / load doors close securely"),item("bodywork","No dangerous bodywork or obvious external damage"),item("ramp","Wheelchair lift / ramp operates correctly",c.wheelchair),item("restraints","Wheelchair and occupant restraints are present and serviceable",c.wheelchair)]},
 {title:"Interior & equipment",items:[item("clean","Interior is clean and suitable for clients"),item("exits","Aisles, exits and footwells are clear"),item("loose","No loose or unsecured objects"),item("firstAid","First-aid kit is present"),item("extinguisher","Fire extinguisher is present and appears serviceable",c.extinguisher),item("highVis","High-visibility vest is present",c.highVis),item("triangle","Warning triangle is present",c.triangle),item("equipment","Required client / accessibility equipment is secure",c.clientEquipment||c.wheelchair)]}
 ];
}
export const answerSchema=z.object({key:z.string().max(80),response:z.enum(["PASS","DEFECT","NA"]),severity:z.enum(["MINOR","CRITICAL"]).optional(),notes:z.string().trim().max(2000).default(""),imageIds:z.array(z.string().uuid()).max(4).default([]),secured:z.boolean().default(false)});
export const submissionSchema=z.object({id:z.string().uuid(),vehicleId:z.string().uuid(),clientStartedAt:z.string().datetime(),mileage:z.number().int().min(0).max(9999999),version:z.literal(CHECKLIST_VERSION),initialImageId:z.string().uuid(),answers:z.array(answerSchema).max(90),declaration:z.literal(true)});
export type Submission=z.infer<typeof submissionSchema>;
export function validateCheck(input:Submission,vehicle:{fuelType:string;config:unknown;mileage:number;status:string}){
 if(vehicle.status==="ARCHIVED")throw Error("This vehicle is archived. Ask management to review your saved check.");
 if(input.mileage<vehicle.mileage)throw Error("Mileage is below the last recorded figure. Ask management to review the vehicle mileage before syncing.");
 if(new Date(input.clientStartedAt).getTime()>Date.now()+300000)throw Error("Check start time is in the future. Check this device's clock.");
 const items=checklist(vehicle.fuelType,vehicle.config).flatMap(s=>s.items);
 if(input.answers.length!==items.length||new Set(input.answers.map(a=>a.key)).size!==items.length)throw Error("Complete every checklist item.");
 const answers=items.map(item=>{
  const a=input.answers.find(a=>a.key===item.key);
  if(!a||(!item.applicable&&a.response!=="NA")||(item.applicable&&a.response==="NA"))throw Error(`Check the answer for ${item.label}.`);
  if(a.response==="DEFECT"&&(!a.notes.trim()||!a.imageIds.length||!a.severity))throw Error(`Add a description, severity and photograph for ${item.label}.`);
  return {...a,label:item.label,severity:a.response==="DEFECT"?(item.stopUse?"CRITICAL":a.severity):null};
 });
 const outcome=vehicle.status==="OUT_OF_SERVICE"||answers.some(a=>a.severity==="CRITICAL")?"UNSAFE":answers.some(a=>a.response==="DEFECT")?"MINOR_DEFECTS":"PASSED";
 return {answers,outcome};
}
export const transitions:Record<string,string[]>={REPORTED:["UNDER_REVIEW"],UNDER_REVIEW:["REPAIR_REQUIRED","NO_FAULT"],REPAIR_REQUIRED:["REPAIRED"],REPAIRED:["VERIFIED"],NO_FAULT:["VERIFIED"],VERIFIED:[],CLOSED:[]};
export function validTransition(from:string,to:string,notes:string){return !!notes.trim()&&!!transitions[from]?.includes(to);}
export function registrationKey(value:string){return value.toUpperCase().replace(/[^A-Z0-9]/g,"");}
