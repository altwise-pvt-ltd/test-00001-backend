// One-off seed: insert a single School + its founding Principal, then build out
// a complete demo dataset for that school — subjects, classes, sections,
// teachers, students, teaching assignments, assignments and submissions — so the
// app has realistic data to log into and click around. A teacher's class/section
// relation comes entirely from their TeachingAssignments (teacher × subject ×
// section), the single source of truth.
//
// This mirrors what the real flow does (auth/register creates the school +
// principal; the principal then creates users/classes/sections/subjects;
// teaching assignments link teachers to subject+section; teachers post
// assignments; students submit; teachers grade).
//
// Idempotent — safe to run repeatedly. Every entity is keyed on its natural
// unique key (principal email, subject name, class level, section name, user
// email, the teach/assign/submit relations), so a re-run never duplicates and
// never overwrites an existing password.
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
const TeachingAssignment = require('./modules/assignment/teachingAssignment.model');
const Assignment = require('./modules/assignment/assignment.model');
const Submission = require('./modules/submission/submission.model');
const { generateInitialPassword } = require('./modules/auth/password');
const { USER_ROLES, ASSIGNMENT_TYPES, SUBMISSION_STATUS } = require('./constant/constant');

// ---- Edit these to taste ----
const SCHOOL = { name: 'Greenwood High', address: '12 Forest Lane' };
const PRINCIPAL = {
  name: 'Rudra Indurkar',
  email: 'principal@greenwood.test',
  password: 'Principal@123', // principal chooses their own password (not DOB)
};

// Subjects offered by the school.
const SUBJECTS = [
  { name: 'Mathematics', code: 'MATH' },
  { name: 'English', code: 'ENG' },
  { name: 'Science', code: 'SCI' },
  { name: 'History', code: 'HIST' },
];

// Classes (grade levels) and the sections within each.
const CLASSES = [
  { level: 5, sections: ['A', 'B'] },
  { level: 6, sections: ['A'] },
];

// Teachers (DOB-derived password: first4(name)@DDMMYYYY).
const TEACHERS = [
  { name: 'Alan Turing', email: 'alan@greenwood.test', dateOfBirth: '1990-03-07' },
  { name: 'Ada Lovelace', email: 'ada@greenwood.test', dateOfBirth: '1988-12-10' },
  { name: 'Marie Curie', email: 'marie@greenwood.test', dateOfBirth: '1985-11-07' },
];

// Students, each placed in a class level + section (DOB-derived password:
// first4(name)+DDMMYYYY).
const STUDENTS = [
  { name: 'Sam Pupil', email: 'sam@greenwood.test', dateOfBirth: '2014-06-21', level: 5, section: 'A' },
  { name: 'Lily Carter', email: 'lily@greenwood.test', dateOfBirth: '2014-02-14', level: 5, section: 'A' },
  { name: 'Noah Brooks', email: 'noah@greenwood.test', dateOfBirth: '2014-09-03', level: 5, section: 'B' },
  { name: 'Mia Patel', email: 'mia@greenwood.test', dateOfBirth: '2013-05-19', level: 6, section: 'A' },
];

// Who teaches what, where: teacher email -> subject name -> [class level + section].
const TEACHING = [
  { teacher: 'alan@greenwood.test', subject: 'Mathematics', level: 5, section: 'A' },
  { teacher: 'alan@greenwood.test', subject: 'Mathematics', level: 5, section: 'B' },
  { teacher: 'marie@greenwood.test', subject: 'Science', level: 5, section: 'A' },
  { teacher: 'ada@greenwood.test', subject: 'English', level: 6, section: 'A' },
];

// Assignments handed out, keyed by the teaching relation above.
const ASSIGNMENTS = [
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
];

// Submissions: student email -> assignment title, with optional grade/feedback.
const SUBMISSIONS = [
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
];
// ------------------------------

// Find-or-create on a unique key. Returns { doc, created }.
async function upsert(Model, key, defaults) {
  let doc = await Model.findOne(key);
  if (doc) return { doc, created: false };
  doc = await Model.create({ ...key, ...defaults });
  return { doc, created: true };
}

async function seed() {
  await connectDB();

  // 1) School + principal (idempotent on principal email; never touch password).
  let principal = await User.findOne({ email: PRINCIPAL.email });
  let school;

  if (principal) {
    school = await School.findById(principal.schoolId);
  } else {
    school = await School.create({ name: SCHOOL.name, address: SCHOOL.address });
    const passwordHash = await bcrypt.hash(PRINCIPAL.password, config.bcryptRounds);
    principal = await User.create({
      name: PRINCIPAL.name,
      email: PRINCIPAL.email,
      passwordHash,
      role: USER_ROLES.PRINCIPAL,
      schoolId: school._id,
    });
    school.createdBy = principal._id;
    await school.save();
  }

  const schoolId = school._id;
  const audit = { createdBy: principal._id };
  const credentials = []; // plaintext logins to print at the end

  // 2) Subjects
  const subjectByName = {};
  for (const s of SUBJECTS) {
    const { doc } = await upsert(Subject, { schoolId, name: s.name }, { code: s.code, ...audit });
    subjectByName[s.name] = doc;
  }

  // 3) Classes + sections
  const classByLevel = {};
  const sectionByKey = {}; // `${level}-${name}` -> section doc
  for (const c of CLASSES) {
    const { doc: classDoc } = await upsert(Class, { schoolId, level: c.level }, { ...audit });
    classByLevel[c.level] = classDoc;
    for (const name of c.sections) {
      const { doc: sectionDoc } = await upsert(
        Section,
        { classId: classDoc._id, name },
        { schoolId, ...audit }
      );
      sectionByKey[`${c.level}-${name}`] = sectionDoc;
    }
  }

  // 4) Teachers (DOB-derived password)
  const teacherByEmail = {};
  for (const t of TEACHERS) {
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

  // 5) Students (placed in class + section)
  const studentByEmail = {};
  for (const st of STUDENTS) {
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

  // 6) Teaching assignments (teacher teaches subject to section)
  const teachingByKey = {}; // `${email}|${subject}|${level}-${section}` -> doc
  for (const ta of TEACHING) {
    const teacher = teacherByEmail[ta.teacher];
    const subject = subjectByName[ta.subject];
    const section = sectionByKey[`${ta.level}-${ta.section}`];
    const { doc } = await upsert(
      TeachingAssignment,
      { teacherId: teacher._id, subjectId: subject._id, sectionId: section._id },
      { schoolId, ...audit }
    );
    teachingByKey[`${ta.teacher}|${ta.subject}|${ta.level}-${ta.section}`] = doc;
  }

  // 7) Assignments (handed out under a teaching assignment)
  const assignmentByTitle = {};
  for (const a of ASSIGNMENTS) {
    const teaching = teachingByKey[`${a.teacher}|${a.subject}|${a.level}-${a.section}`];
    const section = sectionByKey[`${a.level}-${a.section}`];
    const { doc } = await upsert(
      Assignment,
      { schoolId, teachingAssignmentId: teaching._id, title: a.title },
      {
        description: a.description,
        type: a.type,
        dueDate: a.dueDate ? new Date(a.dueDate) : null,
        sectionId: section._id,
        ...audit,
      }
    );
    assignmentByTitle[a.title] = doc;
  }

  // 8) Submissions (+ grading)
  for (const sub of SUBMISSIONS) {
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

  // ---- report ----
  const counts = {
    subjects: await Subject.countDocuments({ schoolId }),
    classes: await Class.countDocuments({ schoolId }),
    sections: await Section.countDocuments({ schoolId }),
    teachers: await User.countDocuments({ schoolId, role: USER_ROLES.TEACHER }),
    // teachers with at least one TeachingAssignment (their class/section relation)
    teachersAssigned: (await TeachingAssignment.distinct('teacherId', { schoolId, deletedAt: null })).length,
    students: await User.countDocuments({ schoolId, role: USER_ROLES.STUDENT }),
    teachingAssignments: await TeachingAssignment.countDocuments({ schoolId }),
    assignments: await Assignment.countDocuments({ schoolId }),
    submissions: await Submission.countDocuments({ schoolId }),
  };

  console.log('\n[seed] done');
  console.log('  school   :', school.name, `(id: ${schoolId})`);
  console.log('  counts   :', JSON.stringify(counts));
  console.log('\n  principal login:');
  console.log('   ', JSON.stringify({ email: PRINCIPAL.email, password: PRINCIPAL.password }));
  console.log('\n  teacher / student logins (DOB-derived):');
  for (const c of credentials) {
    console.log(`    [${c.role}] ${c.email}  ->  ${c.password}`);
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
