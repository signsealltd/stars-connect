import{describe,expect,it}from"vitest";
import{createUserSchema,updateUserSchema,usernameSchema}from"./user-input";
import{readFileSync}from"node:fs";

describe("username management",()=>{
  it("normalises valid usernames and rejects unsafe values",()=>{
    expect(usernameSchema.parse("  Kellie.Manager ")).toBe("kellie.manager");
    expect(usernameSchema.safeParse("two words").success).toBe(false);
    expect(usernameSchema.safeParse("ab").success).toBe(false);
  });
  it("allows an account without an email address",()=>{
    const result=createUserSchema.safeParse({name:"Kellie Manager",username:"kellie",email:"",role:"MANAGER",password:"StrongPassword1"});
    expect(result.success).toBe(true);
    if(result.success)expect(result.data.email).toBeNull();
  });
  it("allows administrators to change a username",()=>expect(updateUserSchema.safeParse({username:"new.name"}).success).toBe(true));
  it("uses username or legacy email without exposing which account exists",()=>{
    const route=readFileSync("src/app/api/auth/login/route.ts","utf8");
    expect(route).toContain("OR:[{username:identifier},{email:identifier}]");
    expect(route).toContain('error:"Invalid credentials"');
  });
  it("migrates existing accounts to unique non-null usernames",()=>{
    const sql=readFileSync("prisma/migrations/202608020001_username_login/migration.sql","utf8");
    expect(sql).toContain("UPDATE `User`");
    expect(sql).toContain("MODIFY `username` VARCHAR(32) NOT NULL");
    expect(sql).toContain("User_username_key");
  });
});