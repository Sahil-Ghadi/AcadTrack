// Augment Express Request with our JWT payload
declare namespace Express {
  interface Request {
    user?: {
      id: number;
      role: "college_admin" | "dept_admin" | "faculty" | "student";
      collegeId: number;
      departmentId: number | null;
    };
  }
}

