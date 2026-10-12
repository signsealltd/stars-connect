import {describe,it,expect,vi} from "vitest";
import {IhascoClient,apiUrl,readCodes,safeIhascoError} from "./ihasco-client";
import {z} from "zod";
import {certificateUrl,publicCertificateAddress,verifyCertificatePdf} from "./ihasco-certificates";

describe("iHasco HTTP client",()=>{
  it("uses server headers and follows documented pagination without exposing credentials",async()=>{
    const transport=vi.fn().mockResolvedValueOnce(Response.json({data:[{id:1}],pagination:{next:"/users?cursor=2"}})).mockResolvedValueOnce(Response.json({data:[{id:2}]}));
    const client=new IhascoClient("secret-value",transport,async()=>{});
    expect(await client.list("/users",z.object({id:z.number()}))).toEqual([{id:1},{id:2}]);
    expect(transport.mock.calls[0][1]).toMatchObject({headers:{Authorization:"Bearer secret-value",Accept:"application/vnd.ihasco.v2+json"},redirect:"error"});
    expect(String(transport.mock.calls[1][0])).toBe("https://api.ihasco.co.uk/users?cursor=2");
    expect(String(transport.mock.calls[0][0])).not.toContain("secret-value");
  });
  it("blocks off-origin pagination and redirects before sending the key",async()=>{
    for(const path of ["https://attacker.invalid/users","http://api.ihasco.co.uk/users","https://user:pass@api.ihasco.co.uk/users","/users?authentication=secret"]){expect(()=>apiUrl(path)).toThrow();}
    const transport=vi.fn().mockResolvedValue(Response.json({data:[],pagination:{next:"https://other.invalid/users"}}));
    await expect(new IhascoClient("secret",transport,async()=>{}).list("/users",z.unknown())).rejects.toThrow("unexpected API URL");expect(transport).toHaveBeenCalledOnce();
  });
  it("handles rate limits with bounded retries and suppresses response bodies and transport errors",async()=>{
    const sleep=vi.fn().mockResolvedValue(undefined),transport=vi.fn().mockResolvedValueOnce(new Response("secret-link",{status:429,headers:{"retry-after":"2"}})).mockResolvedValueOnce(Response.json({data:[]}));
    await new IhascoClient("secret",transport,sleep).request("/users");expect(sleep).toHaveBeenCalledWith(2000);
    const denied=vi.fn().mockResolvedValue(new Response("secret credential echoed",{status:401}));
    await expect(new IhascoClient("secret",denied,async()=>{}).request("/users")).rejects.toThrow("HTTP 401");
    expect(safeIhascoError(new Error("secret credential echoed"))).not.toContain("secret");
  });
  it("requires actual account status metadata instead of hard-coded numeric meanings",()=>{
    expect(readCodes({result_status:{context:"result.status_code",data:[{code:987,description:"Completed successfully"}]}})).toEqual([{code:987,description:"Completed successfully"}]);
    expect(()=>readCodes({result_status:{data:[]}})).toThrow("No success statuses were assumed");
  });
  it("detects pagination loops",async()=>{
    const transport=vi.fn().mockResolvedValue(Response.json({data:[],pagination:{next:"/users"}}));
    await expect(new IhascoClient("secret",transport,async()=>{}).list("/users",z.unknown())).rejects.toThrow("pagination repeated");expect(transport).toHaveBeenCalledOnce();
  });
});
describe("private certificate download boundaries",()=>{
  it("does not guess the base for relative certificate paths",()=>{
    expect(()=>certificateUrl("/training/certificate/download/temporary",undefined,["verified.example"])).toThrow("relative");
    expect(certificateUrl("/training/certificate/download/temporary","https://verified.example/",["verified.example"]).origin).toBe("https://verified.example");
    expect(()=>certificateUrl("https://unverified.example/file",undefined,["verified.example"])).toThrow("allowlist");
    expect(()=>certificateUrl("http://verified.example/file",undefined,["verified.example"])).toThrow("allowlist");
  });
  it("rejects private and link-local DNS results and non-PDF expired-link pages",()=>{
    for(const ip of ["127.0.0.1","10.0.0.1","169.254.169.254","192.168.1.1","172.16.0.1","::1","::ffff:127.0.0.1","fc00::1"])expect(publicCertificateAddress(ip)).toBe(false);
    expect(publicCertificateAddress("8.8.8.8")).toBe(true);
    expect(()=>verifyCertificatePdf(Buffer.from("<html>Expired link</html>"),"text/html")).toThrow("expired link");
    expect(()=>verifyCertificatePdf(Buffer.from("not a PDF"),"application/pdf")).toThrow();
    expect(()=>verifyCertificatePdf(Buffer.from("%PDF-1.4\n"),"application/pdf")).not.toThrow();
  });
});
