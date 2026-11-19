import "fake-indexeddb/auto";
import {openDB,deleteDB} from "idb";
import {generateKeyPairSync,privateDecrypt,createDecipheriv,constants,createHmac} from "crypto";
import {beforeEach,describe,it,expect,vi} from "vitest";
import {enqueueMyday,mydayQueueCount,syncMydayQueue} from "./myday-queue";
import {mydayCanonicalJson,submissionSchema} from "./myday-rules";
const pair=generateKeyPairSync("rsa",{modulusLength:2048});
const grant={id:"11111111-1111-4111-8111-111111111111",secret:"a-protected-author-secret",expiresAt:"2099-01-01T00:00:00Z",publicKey:pair.publicKey.export({format:"jwk"})};
const submission=submissionSchema.parse({id:"22222222-2222-4222-8222-222222222222",requestKey:"33333333-3333-4333-8333-333333333333",studentId:"44444444-4444-4444-8444-444444444444",occurredAt:"2026-01-01T10:00:00.000Z",content:{kind:"GENERAL",text:"Private client observation"}});
beforeEach(async()=>{vi.unstubAllGlobals();await deleteDB("stars-myday-protected")});
describe("protected offline queue",()=>{
 it("persists only server-sealed ciphertext, with an exact-payload author signature",async()=>{await enqueueMyday(submission,grant);const db=await openDB("stars-myday-protected",1),item=await db.get("queue",submission.requestKey);db.close();expect(JSON.stringify(item)).not.toContain("Private client observation");expect(JSON.stringify(item)).not.toContain(grant.secret);expect(await mydayQueueCount()).toBe(1);const sealed=item.envelope,key=privateDecrypt({key:pair.privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:"sha256"},Buffer.from(sealed.key,"base64")),data=Buffer.from(sealed.ciphertext,"base64"),d=createDecipheriv("aes-256-gcm",key,Buffer.from(sealed.iv,"base64"));d.setAuthTag(data.subarray(-16));const decoded=JSON.parse(Buffer.concat([d.update(data.subarray(0,-16)),d.final()]).toString());expect(decoded.submission).toEqual(submission);expect(decoded.signature).toBe(createHmac("sha256",grant.secret).update(mydayCanonicalJson(submission)).digest("hex"));});
 it("keeps queued updates after connection failures and removes only confirmed saves or reviews",async()=>{await enqueueMyday(submission,grant);vi.stubGlobal("fetch",vi.fn().mockRejectedValue(Error("Offline")));expect((await syncMydayQueue()).pending).toBe(1);vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({saved:true})));expect((await syncMydayQueue()).pending).toBe(0);});
 it("retains permanent sync errors for visible retry instead of losing data",async()=>{await enqueueMyday(submission,grant);vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({error:"Authorisation unavailable"},{status:403})));expect((await syncMydayQueue()).pending).toBe(1);});
 it("does not queue new content under an expired offline grant",async()=>{await expect(enqueueMyday(submission,{...grant,expiresAt:"2000-01-01T00:00:00Z"})).rejects.toThrow("Reconnect");expect(await mydayQueueCount()).toBe(0);});
});
