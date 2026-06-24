// One-off seed: bootstrap a platform SUPER-ADMIN, then have that super-admin
// provision MULTIPLE schools — each with a Principal (assigned), subjects,
// classes, sections, teachers, students, subject allocations, assignments and
// submissions — using the SAME services the HTTP endpoints use. Seeding more
// than one school is deliberate: it makes the admin cross-school overview
// (GET /api/admin/overview) meaningful and exercises the admin-managed,
// school-targeted setup of subjects/classes/sections.
//
// A teacher's class/section relation comes entirely from their SubjectAllocations
// (teacher × subject × section), the single source of truth.
//
// This mirrors the real flow AFTER public self-registration was removed:
//   createAdmin (out of band) -> super-admin
//   super-admin -> POST /api/schools (create school)
//   super-admin -> POST /api/principals (create unassigned principal)
//   super-admin -> PATCH /api/schools/:id/principal (assign)
//   super-admin -> POST /api/schools/:schoolId/{subjects,classes,sections}
//                  (admin-managed setup, targeting the school explicitly)
//   principal   -> creates teachers/students + subject allocations
//   subject allocations link teachers to subject+section; teachers post
//   assignments; students submit; teachers grade.
//
// Idempotent — safe to run repeatedly. Every entity is keyed on its natural
// unique key (super-admin email, school name, principal email, subject name,
// class level, section name, user email, the teach/assign/submit relations), so
// a re-run never duplicates and never overwrites an existing password.
//
//   npm run seed
const bcrypt = require('bcryptjs');
const config = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const School = require('./models/School');
const User = require('./modules/users/user.model');
const Class = require('./modules/class/class.model');
const Section = require('./modules/section/section.model');
const Subject = require('./modules/subject/subject.model');
const SubjectAllocation = require('./modules/subjectAllocation/subjectAllocation.model');
const Assignment = require('./modules/assignment/assignment.model');
const Submission = require('./modules/submission/submission.model');
const schoolService = require('./modules/schools/school.service');
const principalService = require('./modules/principals/principal.service');
const subjectService = require('./modules/subject/subject.service');
const classService = require('./modules/class/class.service');
const sectionService = require('./modules/section/section.service');
const { generateInitialPassword } = require('./modules/auth/password');
const { USER_ROLES, ASSIGNMENT_TYPES, SUBMISSION_STATUS } = require('./constant/constant');

// ---- Edit these to taste ----
// The platform authority. In production this comes from src/scripts/createAdmin.js;
// the seed creates one idempotently so the demo is self-contained.
const SUPER_ADMIN = {
  name: 'Platform Admin',
  email: 'admin@platform.test',
  password: 'Admin@12345', // super-admin chooses their own password
};

// Each entry is one fully-described school. The seed drives them through the
// real admin -> principal flow. Two schools are provided so the cross-school
// admin overview has more than one tenant to summarize.
const SCHOOLS = [
  {
    school: { name: 'Greenwood High', address: '12 Forest Lane' },
    principal: {
      name: 'Rudra Indurkar',
      email: 'principal@greenwood.test',
      password: 'Principal@123', // super-admin sets the principal's password (not DOB)
    },
    // Subjects offered by the school (admin-managed).
    subjects: [
      { name: 'Mathematics', code: 'MATH' },
      { name: 'English', code: 'ENG' },
      { name: 'Science', code: 'SCI' },
      { name: 'History', code: 'HIST' },
    ],
    // Classes (grade levels) and the sections within each (admin-managed).
    classes: [
      { level: 5, sections: ['A', 'B'] },
      { level: 6, sections: ['A'] },
    ],
    // Teachers (DOB-derived password: first4(name)@DDMMYYYY).
    teachers: [
      { name: 'Alan Turing', email: 'alan@greenwood.test', dateOfBirth: '1990-03-07' },
      { name: 'Ada Lovelace', email: 'ada@greenwood.test', dateOfBirth: '1988-12-10' },
      { name: 'Marie Curie', email: 'marie@greenwood.test', dateOfBirth: '1985-11-07' },
    ],
    // Students, placed in a class level + section (DOB-derived password:
    // first4(name)+DDMMYYYY).
    students: [
      { name: 'Sam Pupil', email: 'sam@greenwood.test', dateOfBirth: '2014-06-21', level: 5, section: 'A' },
      { name: 'Lily Carter', email: 'lily@greenwood.test', dateOfBirth: '2014-02-14', level: 5, section: 'A' },
      { name: 'Noah Brooks', email: 'noah@greenwood.test', dateOfBirth: '2014-09-03', level: 5, section: 'B' },
      { name: 'Mia Patel', email: 'mia@greenwood.test', dateOfBirth: '2013-05-19', level: 6, section: 'A' },
    ],
    // Who teaches what, where: teacher email -> subject name -> [class level + section].
    teaching: [
      { teacher: 'alan@greenwood.test', subject: 'Mathematics', level: 5, section: 'A' },
      { teacher: 'alan@greenwood.test', subject: 'Mathematics', level: 5, section: 'B' },
      { teacher: 'marie@greenwood.test', subject: 'Science', level: 5, section: 'A' },
      { teacher: 'ada@greenwood.test', subject: 'English', level: 6, section: 'A' },
    ],
    // Assignments handed out, keyed by the teaching relation above.
    assignments: [
      {
        teacher: 'alan@greenwood.test', subject: 'Mathematics', level: 5, section: 'A',
        title: 'Fractions worksheet', description: 'Complete problems 1-20 on fractions.',
        type: ASSIGNMENT_TYPES.HOMEWORK, dueDate: '2026-07-01',
      },
      {
        teacher: 'marie@greenwood.test', subject: 'Science', level: 5, section: 'A',
        title: 'Read chapter 4', description: 'Read and summarize chapter 4 on the water cycle.',
        type: ASSIGNMENT_TYPES.READING, dueDate: '2026-07-05',
      },
      {
        teacher: 'ada@greenwood.test', subject: 'English', level: 6, section: 'A',
        title: 'Book report: Charlotte\'s Web', description: 'Write a one-page book report.',
        type: ASSIGNMENT_TYPES.BOOK, dueDate: '2026-07-10',
      },
    ],
    // Submissions: student email -> assignment title, with optional grade/feedback.
    submissions: [
      {
        student: 'sam@greenwood.test', assignment: 'Fractions worksheet',
        content: 'My answers to problems 1-20 are attached.',
        grade: 'A', feedback: 'Great work!',
      },
      {
        student: 'lily@greenwood.test', assignment: 'Fractions worksheet',
        content: 'Here are my fraction answers.',
        // ungraded -> stays "submitted"
      },
      {
        student: 'sam@greenwood.test', assignment: 'Read chapter 4',
        content: 'The water cycle has evaporation, condensation and precipitation...',
        grade: 'B+', feedback: 'Good summary, add more detail next time.',
      },
    ],
  },

  {
    school: { name: 'Riverdale High', address: '42 River Road' },
    principal: {
      name: 'Hermione Granger',
      email: 'principal@riverdale.test',
      password: 'Principal@123',
    },
    subjects: [
      { name: 'Mathematics', code: 'MATH' },
      { name: 'English', code: 'ENG' },
      { name: 'Physics', code: 'PHY' },
    ],
    classes: [
      { level: 8, sections: ['A'] },
      { level: 9, sections: ['A', 'B'] },
    ],
    teachers: [
      { name: 'Grace Hopper', email: 'grace@riverdale.test', dateOfBirth: '1980-12-09' },
      { name: 'Katherine Johnson', email: 'katherine@riverdale.test', dateOfBirth: '1975-08-26' },
    ],
    students: [
      { name: 'Riya Sen', email: 'riya@riverdale.test', dateOfBirth: '2012-01-15', level: 8, section: 'A' },
      { name: 'Omar Khan', email: 'omar@riverdale.test', dateOfBirth: '2012-03-22', level: 8, section: 'A' },
      { name: 'Tara Roy', email: 'tara@riverdale.test', dateOfBirth: '2011-11-05', level: 9, section: 'A' },
    ],
    teaching: [
      { teacher: 'grace@riverdale.test', subject: 'Mathematics', level: 8, section: 'A' },
      { teacher: 'grace@riverdale.test', subject: 'Mathematics', level: 9, section: 'A' },
      { teacher: 'katherine@riverdale.test', subject: 'Physics', level: 9, section: 'A' },
    ],
    assignments: [
      {
        teacher: 'grace@riverdale.test', subject: 'Mathematics', level: 8, section: 'A',
        title: 'Algebra basics', description: 'Solve the linear equations on the handout.',
        type: ASSIGNMENT_TYPES.HOMEWORK, dueDate: '2026-07-03',
      },
      {
        teacher: 'katherine@riverdale.test', subject: 'Physics', level: 9, section: 'A',
        title: "Newton's laws reading", description: "Read and summarize Newton's three laws.",
        type: ASSIGNMENT_TYPES.READING, dueDate: '2026-07-08',
      },
    ],
    submissions: [
      {
        student: 'riya@riverdale.test', assignment: 'Algebra basics',
        content: 'Worked solutions for all 12 equations.',
        grade: 'A-', feedback: 'Clean work — watch your sign errors.',
      },
      {
        student: 'omar@riverdale.test', assignment: 'Algebra basics',
        content: 'My answers are attached.',
        // ungraded -> stays "submitted"
      },
    ],
  },
];
// ------------------------------

// Find-or-create on a unique key. Returns { doc, created }.
async function upsert(Model, key, defaults) {
  let doc = await Model.findOne(key);
  if (doc) return { doc, created: false };
  doc = await Model.create({ ...key, ...defaults });
  return { doc, created: true };
}

// Seed one school's complete dataset, driven through the real services. Returns
// { counts, credentials } for the run report. `superAdmin` provisions the school,
// the principal, and (admin-managed) subjects/classes/sections; the principal
// owns teachers/students and their subject allocations.
async function seedSchool(superAdmin, def) {
  const adminId = superAdmin._id; // super-admin manages subjects/classes/sections

  // 1) School — provisioned BY the super-admin via the schools service
  //    (idempotent on school name).
  let school = await School.findOne({ name: def.school.name, deletedAt: null });
  if (!school) {
    school = await schoolService.createSchool(
      { name: def.school.name, address: def.school.address },
      superAdmin._id
    );
  }

  // 2) Principal — created STANDALONE (schoolId null) by the super-admin via the
  //    principals service (idempotent on principal email; never touch password).
  let principal = await User.findOne({ email: def.principal.email, role: USER_ROLES.PRINCIPAL });
  if (!principal) {
    principal = await principalService.createPrincipal(
      { name: def.principal.name, email: def.principal.email, password: def.principal.password },
      superAdmin._id
    );
  }

  // 3) Assign the principal to the school (a SEPARATE operation), unless already
  //    assigned there. Uses the same transactional service the endpoint uses.
  if (!principal.schoolId || String(principal.schoolId) !== String(school._id)) {
    const assigned = await schoolService.assignPrincipal(school._id, principal._id);
    principal = assigned.principal;
  }

  const schoolId = school._id;
  const audit = { createdBy: principal._id }; // principal manages people + allocations
  const credentials = []; // plaintext logins to print at the end

  // Idempotent wrappers that EXERCISE the admin-managed creation paths: the
  // super-admin targets THIS school explicitly (the same call shape as
  // POST /api/schools/:schoolId/{subjects,classes,sections}). Each service
  // re-verifies the target school exists before acting.
  async function ensureSubject(name, code) {
    const found = await Subject.findOne({ schoolId, name, deletedAt: null });
    if (found) return found;
    return subjectService.createSubject(schoolId, { name, code }, adminId);
  }
  async function ensureClass(level) {
    const found = await Class.findOne({ schoolId, level, deletedAt: null });
    if (found) return found;
    return classService.createClass(schoolId, { level }, adminId);
  }
  async function ensureSection(classId, name) {
    const found = await Section.findOne({ schoolId, classId, name, deletedAt: null });
    if (found) return found;
    return sectionService.createSection(schoolId, { name, classId }, adminId);
  }

  // 4) Subjects (admin-managed)
  const subjectByName = {};
  for (const s of def.subjects) {
    subjectByName[s.name] = await ensureSubject(s.name, s.code);
  }

  // 5) Classes + sections (admin-managed)
  const classByLevel = {};
  const sectionByKey = {}; // `${level}-${name}` -> section doc
  for (const c of def.classes) {
    const classDoc = await ensureClass(c.level);
    classByLevel[c.level] = classDoc;
    for (const name of c.sections) {
      const sectionDoc = await ensureSection(classDoc._id, name);
      sectionByKey[`${c.level}-${name}`] = sectionDoc;
    }
  }

  // 6) Teachers (DOB-derived password) — principal-managed
  const teacherByEmail = {};
  for (const t of def.teachers) {
    let doc = await User.findOne({ schoolId, email: t.email });
    const initialPassword = generateInitialPassword({
      role: USER_ROLES.TEACHER, name: t.name, dateOfBirth: t.dateOfBirth,
    });
    if (!doc) {
      const passwordHash = await bcrypt.hash(initialPassword, config.bcryptRounds);
      doc = await User.create({
        name: t.name,
        email: t.email,
        passwordHash,
        role: USER_ROLES.TEACHER,
        schoolId,
        dateOfBirth: t.dateOfBirth,
        ...audit,
      });
    }
    teacherByEmail[t.email] = doc;
    credentials.push({ role: 'teacher', email: t.email, password: initialPassword });
  }

  // 7) Students (placed in class + section) — principal-managed
  const studentByEmail = {};
  for (const st of def.students) {
    const section = sectionByKey[`${st.level}-${st.section}`];
    const classDoc = classByLevel[st.level];
    let doc = await User.findOne({ schoolId, email: st.email });
    const initialPassword = generateInitialPassword({
      role: USER_ROLES.STUDENT, name: st.name, dateOfBirth: st.dateOfBirth,
    });
    if (!doc) {
      const passwordHash = await bcrypt.hash(initialPassword, config.bcryptRounds);
      doc = await User.create({
        name: st.name,
        email: st.email,
        passwordHash,
        role: USER_ROLES.STUDENT,
        schoolId,
        classId: classDoc._id,
        sectionId: section._id,
        dateOfBirth: st.dateOfBirth,
        ...audit,
      });
    }
    studentByEmail[st.email] = doc;
    credentials.push({ role: 'student', email: st.email, password: initialPassword });
  }

  // 8) Subject allocations (teacher teaches subject to section) — principal-managed
  const teachingByKey = {}; // `${email}|${subject}|${level}-${section}` -> doc
  for (const ta of def.teaching) {
    const teacher = teacherByEmail[ta.teacher];
    const subject = subjectByName[ta.subject];
    const section = sectionByKey[`${ta.level}-${ta.section}`];
    const { doc } = await upsert(
      SubjectAllocation,
      { teacherId: teacher._id, subjectId: subject._id, sectionId: section._id },
      { schoolId, classId: section.classId, ...audit }
    );
    teachingByKey[`${ta.teacher}|${ta.subject}|${ta.level}-${ta.section}`] = doc;
  }

  // 9) Assignments (handed out under a subject allocation)
  const assignmentByTitle = {};
  for (const a of def.assignments) {
    const teaching = teachingByKey[`${a.teacher}|${a.subject}|${a.level}-${a.section}`];
    const section = sectionByKey[`${a.level}-${a.section}`];
    const { doc } = await upsert(
      Assignment,
      { schoolId, subjectAllocationId: teaching._id, title: a.title },
      {
        description: a.description,
        type: a.type,
        dueDate: a.dueDate ? new Date(a.dueDate) : null,
        sectionId: section._id,
        // an assignment is authored by the teacher who teaches it
        createdBy: teaching.teacherId,
      }
    );
    assignmentByTitle[a.title] = doc;
  }

  // 10) Submissions (+ grading)
  for (const sub of def.submissions) {
    const student = studentByEmail[sub.student];
    const assignment = assignmentByTitle[sub.assignment];
    const graded = sub.grade != null;
    await upsert(
      Submission,
      { assignmentId: assignment._id, studentId: student._id },
      {
        content: sub.content || '',
        status: graded ? SUBMISSION_STATUS.GRADED : SUBMISSION_STATUS.SUBMITTED,
        grade: graded ? sub.grade : null,
        feedback: graded ? sub.feedback : null,
        gradedBy: graded ? assignment.createdBy : null,
        gradedAt: graded ? new Date() : null,
        schoolId,
      }
    );
  }

  const counts = {
    subjects: await Subject.countDocuments({ schoolId }),
    classes: await Class.countDocuments({ schoolId }),
    sections: await Section.countDocuments({ schoolId }),
    teachers: await User.countDocuments({ schoolId, role: USER_ROLES.TEACHER }),
    // teachers with at least one SubjectAllocation (their class/section relation)
    teachersAssigned: (await SubjectAllocation.distinct('teacherId', { schoolId, deletedAt: null })).length,
    students: await User.countDocuments({ schoolId, role: USER_ROLES.STUDENT }),
    subjectAllocations: await SubjectAllocation.countDocuments({ schoolId }),
    assignments: await Assignment.countDocuments({ schoolId }),
    submissions: await Submission.countDocuments({ schoolId }),
  };

  return { school, principal, counts, credentials };
}

async function seed() {
  await connectDB();

  // Super-admin (idempotent on email; never touch an existing password). This is
  // the only role created out of band — mirrors createAdmin.js.
  let superAdmin = await User.findOne({ email: SUPER_ADMIN.email, role: USER_ROLES.SUPER_ADMIN });
  if (!superAdmin) {
    const passwordHash = await bcrypt.hash(SUPER_ADMIN.password, config.bcryptRounds);
    superAdmin = await User.create({
      name: SUPER_ADMIN.name,
      email: SUPER_ADMIN.email,
      passwordHash,
      role: USER_ROLES.SUPER_ADMIN,
      schoolId: null,
    });
  }

  const results = [];
  for (const def of SCHOOLS) {
    results.push(await seedSchool(superAdmin, def));
  }

  // ---- report ----
  console.log('\n[seed] done');
  console.log('\n  super-admin login (platform authority, no school):');
  console.log('   ', JSON.stringify({ email: SUPER_ADMIN.email, password: SUPER_ADMIN.password }));

  for (const r of results) {
    console.log(`\n  ===== ${r.school.name} (id: ${r.school._id}) =====`);
    console.log('  counts   :', JSON.stringify(r.counts));
    console.log('  principal login:');
    const principalDef = SCHOOLS.find((s) => s.school.name === r.school.name).principal;
    console.log('   ', JSON.stringify({ email: principalDef.email, password: principalDef.password }));
    console.log('  teacher / student logins (DOB-derived):');
    for (const c of r.credentials) {
      console.log(`    [${c.role}] ${c.email}  ->  ${c.password}`);
    }
  }
}

seed()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
