SELECT "id", "email", "name", CASE WHEN "password" IS NOT NULL THEN true ELSE false END as has_pw FROM "User";
