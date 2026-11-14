export type EntityType = "student" | "faculty" | "marks" | "attendance";

export interface CanonicalField {
  key: string;
  label: string;
  required: boolean;
  description: string;
  aliases: string[];
}

export const STUDENT_FIELDS: CanonicalField[] = [
  {
    key: "roll_no",
    label: "Roll Number",
    required: true,
    description: "Unique student roll number (e.g. 24B-CO-049)",
    aliases: [
      "roll_no", "rollno", "roll_number", "roll", "prn", "urn", "registration_no",
      "reg_no", "seat_no", "student_id", "roll_num", "student_roll",
    ],
  },
  {
    key: "full_name",
    label: "Full Name",
    required: true,
    description: "Student full name (e.g. Sahil Ghadi)",
    aliases: [
      "full_name", "fullname", "name", "student_name", "candidate_name",
      "candidate", "student", "first_name", "applicant_name",
    ],
  },
  {
    key: "email",
    label: "Email Address",
    required: true,
    description: "Valid institutional or personal email address",
    aliases: [
      "email", "email_id", "email_address", "student_email", "mail", "mail_id",
      "official_email", "e_mail",
    ],
  },
  {
    key: "section",
    label: "Section / Division",
    required: true,
    description: "Section name (e.g. A, B, Section A)",
    aliases: [
      "section", "sec", "division", "div", "class_section", "class_div", "section_name",
    ],
  },
  {
    key: "admission_year",
    label: "Admission Year",
    required: true,
    description: "Year of admission as 4-digit number (e.g. 2024)",
    aliases: [
      "admission_year", "adm_year", "year_of_admission", "joining_year",
      "join_year", "admitted_year", "batch_year", "entry_year",
    ],
  },
  {
    key: "department",
    label: "Department",
    required: false,
    description: "Department code or name (e.g. CO, Computer Engineering)",
    aliases: [
      "department", "dept", "department_code", "dept_code", "branch",
      "branch_code", "department_name", "discipline",
    ],
  },
  {
    key: "program",
    label: "Program / Degree",
    required: false,
    description: "Degree program name (e.g. B.E., Computer Engineering)",
    aliases: [
      "program", "course", "degree", "program_name", "course_name",
    ],
  },
  {
    key: "batch",
    label: "Batch",
    required: false,
    description: "Batch years or start year (e.g. 2024-2028 or 2024)",
    aliases: [
      "batch", "admission_batch", "academic_batch", "batch_name",
    ],
  },
  {
    key: "lab_group",
    label: "Lab Group",
    required: false,
    description: "Practical / Lab group name (e.g. A1, A2)",
    aliases: [
      "lab_group", "labgroup", "group", "batch_group", "practical_group",
      "lab_batch", "practical_batch", "sub_group", "lab_subgroup",
    ],
  },
];

export const FACULTY_FIELDS: CanonicalField[] = [
  {
    key: "employee_code",
    label: "Employee Code / ID",
    required: true,
    description: "Unique employee identification code (e.g. EMP101)",
    aliases: [
      "employee_code", "employee_id", "emp_code", "emp_id", "faculty_code",
      "faculty_id", "teacher_id", "staff_id", "code", "id", "staff_code",
    ],
  },
  {
    key: "full_name",
    label: "Full Name",
    required: true,
    description: "Faculty full name (e.g. Dr. Meera Kulkarni)",
    aliases: [
      "full_name", "fullname", "name", "faculty_name", "teacher_name",
      "professor_name", "employee_name", "staff_name",
    ],
  },
  {
    key: "email",
    label: "Email Address",
    required: true,
    description: "Official institutional email address",
    aliases: [
      "email", "email_id", "email_address", "official_email", "mail",
      "faculty_email", "staff_email", "e_mail",
    ],
  },
  {
    key: "department",
    label: "Department",
    required: true,
    description: "Department code or name (e.g. CO, Computer Engineering)",
    aliases: [
      "department", "dept", "department_code", "dept_code", "branch",
      "branch_code", "department_name", "discipline",
    ],
  },
  {
    key: "designation",
    label: "Designation",
    required: false,
    description: "Academic title/rank (e.g. Associate Professor, HOD)",
    aliases: [
      "designation", "position", "title", "role", "post", "designation_name",
    ],
  },
];

export const MARKS_FIELDS: CanonicalField[] = [
  {
    key: "roll_no",
    label: "Roll Number",
    required: true,
    description: "Unique student roll number (e.g. 24B-CO-049)",
    aliases: [
      "roll_no", "rollno", "roll_number", "roll", "prn", "urn", "registration_no",
      "reg_no", "seat_no", "student_id", "roll_num", "student_roll",
    ],
  },
  {
    key: "marks",
    label: "Marks / Score",
    required: true,
    description: "Assessment score obtained (e.g. 18.5)",
    aliases: [
      "marks", "mark", "score", "marks_obtained", "obtained_marks",
      "internal_marks", "it_marks", "it_score", "assignment_marks", "result",
    ],
  },
  {
    key: "student_name",
    label: "Student Name",
    required: false,
    description: "Optional student name for verification",
    aliases: [
      "student_name", "name", "full_name", "fullname", "candidate_name", "student",
    ],
  },
];

export const ATTENDANCE_FIELDS: CanonicalField[] = [
  {
    key: "roll_no",
    label: "Roll Number",
    required: true,
    description: "Unique student roll number (e.g. 24B-CO-049)",
    aliases: [
      "roll_no", "rollno", "roll_number", "roll", "prn", "urn", "registration_no",
      "reg_no", "seat_no", "student_id", "roll_num", "student_roll",
    ],
  },
  {
    key: "status",
    label: "Attendance Status",
    required: true,
    description: "Attendance status: Present (P) or Absent (A)",
    aliases: [
      "status", "attendance", "attendance_status", "att_status", "present_absent",
      "attendance_mark", "att", "state",
    ],
  },
  {
    key: "student_name",
    label: "Student Name",
    required: false,
    description: "Optional student name for verification",
    aliases: [
      "student_name", "name", "full_name", "fullname", "candidate_name", "student",
    ],
  },
];

export function getCanonicalFields(entityType: EntityType): CanonicalField[] {
  switch (entityType) {
    case "student":
      return STUDENT_FIELDS;
    case "faculty":
      return FACULTY_FIELDS;
    case "marks":
      return MARKS_FIELDS;
    case "attendance":
      return ATTENDANCE_FIELDS;
  }
}

/**
 * Normalize header for comparison: strip non-alphanumeric, lowercase, collapse spaces/underscores.
 */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Match a raw header against canonical fields and aliases.
 * Returns the matching canonical key if confident, or null.
 */
export function matchHeaderToCanonical(
  rawHeader: string,
  canonicalFields: CanonicalField[],
): string | null {
  const norm = normalizeHeader(rawHeader);
  if (!norm) return null;

  // 1. Exact match on canonical key
  const exactKey = canonicalFields.find((f) => f.key === norm);
  if (exactKey) return exactKey.key;

  // 2. Exact match in alias list
  for (const field of canonicalFields) {
    if (field.aliases.includes(norm)) {
      return field.key;
    }
  }

  return null;
}

/**
 * Automatically detect mappings for an array of CSV headers.
 * Resolves conflicts: if multiple headers point to the same canonical field,
 * it leaves ambiguous columns unmapped rather than guessing.
 */
export function detectHeaderMappings(
  rawHeaders: string[],
  entityType: EntityType,
): Record<string, string> {
  const fields = getCanonicalFields(entityType);
  const mappings: Record<string, string> = {};
  const canonicalToHeaders: Record<string, string[]> = {};

  for (const header of rawHeaders) {
    const matchedKey = matchHeaderToCanonical(header, fields);
    if (matchedKey) {
      if (!canonicalToHeaders[matchedKey]) {
        canonicalToHeaders[matchedKey] = [];
      }
      canonicalToHeaders[matchedKey].push(header);
    }
  }

  // Assign only unambiguous matches
  for (const [canonicalKey, matchedHeaders] of Object.entries(canonicalToHeaders)) {
    if (matchedHeaders.length === 1) {
      mappings[matchedHeaders[0]] = canonicalKey;
    }
  }

  return mappings;
}
