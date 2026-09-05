-- Fail on historical duplicates; never choose or delete a student's memory automatically.
CREATE UNIQUE INDEX "agent_memory_entries_source_candidate_unique" ON "agent_memory_entries" USING btree ("source_candidate_id");
