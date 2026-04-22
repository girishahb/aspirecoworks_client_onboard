-- Speeds aggregator company list (WHERE createdById = ?) and global ORDER BY createdAt DESC.
CREATE INDEX "client_profiles_createdById_idx" ON "client_profiles"("createdById");
CREATE INDEX "client_profiles_createdAt_idx" ON "client_profiles"("createdAt");
