import {describe,it,expect} from 'vitest';
import {STAFF_GRADES,staffGrade,STAFF_GRADE_ROLES} from './staff-grades';
import {staffUpdateSchema} from './staff-input';
import {canAssignStaffGrade} from './staff-grade-access';
describe('Staff grades',()=>{
 it('offers exactly the five requested grades',()=>expect(STAFF_GRADES).toEqual(['Administrator','Assistant Manager','Manager','Team Leader','Support Worker']));
 it('recognises existing titles without guessing unknown jobs',()=>{expect(staffGrade(' support worker ')).toBe('Support Worker');expect(staffGrade('Care Assistant')).toBe('Support Worker');expect(staffGrade('Assistant Manager')).toBe('Assistant Manager');expect(staffGrade('Driver')).toBeUndefined()});
 it('accepts the dropdown values and rejects arbitrary new titles',()=>{for(const jobRole of STAFF_GRADES)expect(staffUpdateSchema.safeParse({jobRole}).success).toBe(true);expect(staffUpdateSchema.safeParse({jobRole:'Superuser'}).success).toBe(false)});
 it('keeps assistant-manager and manager permission sets independently named',()=>{expect(STAFF_GRADE_ROLES['Assistant Manager']).toBe('MANAGER');expect(STAFF_GRADE_ROLES.Manager).toBe('MANAGER')});
 it('requires explicit user management before a job edit can alter account access',()=>{expect(canAssignStaffGrade({role:'MANAGER',permissionOverrides:null})).toBe(false);expect(canAssignStaffGrade({role:'ADMINISTRATOR',permissionOverrides:null})).toBe(true)});
});
