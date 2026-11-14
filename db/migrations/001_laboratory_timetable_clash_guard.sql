-- =====================================================================
-- Migration 001: Laboratory Timetable Conflict & Interval Clash Guard
-- =====================================================================
-- Enforces:
-- 1. Faculty conflict: Same faculty cannot be scheduled for overlapping sessions in the same term & day.
-- 2. Room conflict: Same room cannot be scheduled for overlapping sessions in the same term & day.
-- 3. Lab group conflict: Same lab group cannot be scheduled for overlapping sessions in the same term & day.
-- 4. Section conflict: Two whole-section sessions (where lab_group_id IS NULL) for the same section cannot overlap.
-- 5. Section vs Lab Group conflict: A whole-section session cannot overlap with a lab-group session for that section.
-- 6. Permitted concurrency: Two different lab groups of the same section CAN be scheduled concurrently in different rooms with different faculty.

DROP TRIGGER IF EXISTS timetable_slot_clash_guard ON timetable_slot;
DROP FUNCTION IF EXISTS trg_timetable_slot_clash_guard();

CREATE OR REPLACE FUNCTION trg_timetable_slot_clash_guard() RETURNS trigger AS $$
DECLARE
    new_section_id   bigint;
    new_lab_group_id bigint;
    conflict_rec     record;
BEGIN
    -- Ensure faculty_id and term_id are populated from subject_assignment.
    -- In INSERTs or when subject_assignment_id changed on UPDATE, refresh from subject_assignment.
    IF TG_OP = 'INSERT' OR NEW.faculty_id IS NULL OR NEW.term_id IS NULL
       OR (TG_OP = 'UPDATE' AND NEW.subject_assignment_id <> OLD.subject_assignment_id) THEN
        SELECT faculty_id, term_id INTO NEW.faculty_id, NEW.term_id
        FROM subject_assignment WHERE id = NEW.subject_assignment_id;
    END IF;

    -- Transaction-level advisory lock scoped to academic term and day of week.
    -- Serializes concurrent timetable insertions and updates for the same term and day,
    -- preventing race conditions and phantom bypasses under READ COMMITTED transactions.
    PERFORM pg_advisory_xact_lock(hashtext('timetable_slot_clash_' || NEW.term_id::text || '_' || NEW.day_of_week::text));

    -- Retrieve section_id and lab_group_id from subject_assignment
    SELECT section_id, lab_group_id INTO new_section_id, new_lab_group_id
    FROM subject_assignment WHERE id = NEW.subject_assignment_id;

    -- Check for overlapping timetable slots in the same academic term and day of week
    -- Interval overlap condition: ts.start_time < NEW.end_time AND ts.end_time > NEW.start_time
    FOR conflict_rec IN
        SELECT ts.id, ts.room, ts.faculty_id, ts.start_time, ts.end_time,
               sa.section_id, sa.lab_group_id,
               f.full_name AS faculty_name,
               su.code AS subject_code
        FROM timetable_slot ts
        JOIN subject_assignment sa ON sa.id = ts.subject_assignment_id
        JOIN faculty f             ON f.id = ts.faculty_id
        JOIN subject su            ON su.id = sa.subject_id
        WHERE ts.term_id = NEW.term_id
          AND ts.day_of_week = NEW.day_of_week
          AND ts.start_time < NEW.end_time
          AND ts.end_time > NEW.start_time
          AND (NEW.id IS NULL OR ts.id <> NEW.id)
    LOOP
        -- 1. Faculty conflict
        IF conflict_rec.faculty_id = NEW.faculty_id THEN
            RAISE EXCEPTION 'Faculty clash: Faculty % is already scheduled from % to %',
                conflict_rec.faculty_name, conflict_rec.start_time, conflict_rec.end_time;
        END IF;

        -- 2. Room conflict
        IF conflict_rec.room = NEW.room THEN
            RAISE EXCEPTION 'Room clash: Room % is already occupied from % to %',
                conflict_rec.room, conflict_rec.start_time, conflict_rec.end_time;
        END IF;

        -- 3. Section conflicts
        IF conflict_rec.section_id = new_section_id THEN
            -- 3a. Both are whole-section (lab_group_id IS NULL)
            IF conflict_rec.lab_group_id IS NULL AND new_lab_group_id IS NULL THEN
                RAISE EXCEPTION 'Section clash: Section is already scheduled for lecture (%) from % to %',
                    conflict_rec.subject_code, conflict_rec.start_time, conflict_rec.end_time;
            END IF;

            -- 3b. Whole section vs lab group
            IF (conflict_rec.lab_group_id IS NULL AND new_lab_group_id IS NOT NULL)
               OR (conflict_rec.lab_group_id IS NOT NULL AND new_lab_group_id IS NULL) THEN
                RAISE EXCEPTION 'Section clash: Cannot schedule concurrent whole-section lecture and lab group for the same section from % to %',
                    conflict_rec.start_time, conflict_rec.end_time;
            END IF;

            -- 3c. Same lab group conflict
            IF conflict_rec.lab_group_id IS NOT NULL
               AND new_lab_group_id IS NOT NULL
               AND conflict_rec.lab_group_id = new_lab_group_id THEN
                RAISE EXCEPTION 'Lab group clash: Lab group is already scheduled from % to %',
                    conflict_rec.start_time, conflict_rec.end_time;
            END IF;

            -- Note: If conflict_rec.lab_group_id <> new_lab_group_id (both non-null),
            -- with different rooms and faculty, it is permitted concurrency.
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER timetable_slot_clash_guard
    BEFORE INSERT OR UPDATE ON timetable_slot
    FOR EACH ROW EXECUTE FUNCTION trg_timetable_slot_clash_guard();

