-- Settings-created staff-grade accounts must follow the same configured grades
-- as accounts linked through staff profiles. Do not infer either manager grade.
UPDATE `User` u
JOIN `AccessLevel` a ON
  (u.role = 'TEAM_LEADER' AND a.name = 'Team Leader' AND a.baseRole = 'TEAM_LEADER')
  OR (u.role = 'CARE_ASSISTANT' AND a.name = 'Support Worker' AND a.baseRole = 'CARE_ASSISTANT')
SET u.accessLevelId = a.id, u.permissionOverrides = a.permissions
WHERE u.accessLevelId IS NULL;
