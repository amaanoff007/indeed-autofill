// Your answers. Edit this file, then hit the reload icon on chrome://extensions.
//
// Each rule: { q: regex tested against the question text,
//              text: value for text/number fields (string, or fn(ctx) -> string|null),
//              pick: regex for choosing a radio/select option }
// ctx = { q, numeric, intOnly }  — intOnly is true when the field rejects decimals.
// A rule returning null (or with no text/pick for that field type) leaves the field
// unfilled and highlighted orange for you to answer. First matching rule wins.

const ME = {
  firstName: 'Amaan',
  lastName: 'Akhter',
  email: 'amaanakhter19@gmail.com',
  phone: '9560348712',
  city: 'Gurgaon, Haryana',
  linkedin: 'https://linkedin.com/in/Amaan',
  github: 'https://github.com/Amaan',
  totalExp: 2.3,
  currentCtcLpa: 10.5,
  expectedCtcLpa: 15,
  noticeDays: 30,
  company: 'QRyde',
  title: 'Software Engineer',
  degree: 'B.Tech in Mathematics and Computer Science',
  college: 'Delhi Technological University',
  gradYear: '2024',
  cgpa: '7.8',
};

// Search-page filter: minimum annual CTC (₹). Jobs with no salary listed also pass.
const MIN_ANNUAL_CTC = 1000000;

// Years per skill (must stay within totalExp).
const SKILL_YEARS = [
  [/react|javascript|\bjs\b|typescript|node|express|mongo|socket|front[\s-]?end|full[\s-]?stack|web dev|rest|api|html|css|git\b/i, 2],
  [/python|fastapi|next\.?js|postgres|redis|sql|c\+\+|playwright|celery|docker|back[\s-]?end/i, 1],
];

const yrs = n => ({ intOnly }) => String(intOnly ? Math.floor(n) : n);

// lpa -> answer in whatever unit the question seems to want
const money = (lpa, round) => ({ q, numeric, intOnly }) => {
  if (/lakh|lac|lpa/i.test(q)) return String(intOnly ? round(lpa) : lpa);
  if (/month/i.test(q)) return String(Math.round((lpa * 100000) / 12));
  if (numeric) return String(Math.round(lpa * 100000));
  return `${lpa} LPA`;
};

const YES = /^\s*yes/i;
const NO = /^\s*no/i;

const RULES = [
  // contact (only fills empty fields; Indeed usually prefills these)
  { q: /first name/i, text: ME.firstName },
  { q: /last name|surname/i, text: ME.lastName },
  { q: /full name|^name$|your name/i, text: `${ME.firstName} ${ME.lastName}` },
  { q: /e-?mail/i, text: ME.email },
  { q: /phone|mobile|contact number/i, text: ME.phone },
  { q: /linkedin/i, text: ME.linkedin },
  { q: /github|portfolio|website/i, text: ME.github },

  // compensation (combined question first)
  { q: /current.*expected.*(ctc|salary)|(ctc|salary).*current.*expected/i,
    text: `Current: ${ME.currentCtcLpa} LPA, Expected: ${ME.expectedCtcLpa} LPA` },
  { q: /(expected|desired|expectation).*(ctc|salary|compensation|package|pay)|salary expectation/i,
    text: money(ME.expectedCtcLpa, Math.round) },
  { q: /(current|present|existing|last drawn).*(ctc|salary|compensation|package)|ctc/i,
    text: money(ME.currentCtcLpa, Math.floor) },

  // notice period / availability
  { q: /notice period|how soon.*join|joining|serve.*notice/i,
    text: ({ numeric }) => (numeric ? String(ME.noticeDays) : `${ME.noticeDays} days`),
    pick: /30|1 month|one month|within a month/i },
  { q: /immediate(ly)? (joiner|join|available)/i, text: 'No', pick: NO },

  // per-skill experience ("years of experience with React", "do you have experience in Node")
  ...SKILL_YEARS.map(([re, n]) => ({
    q: new RegExp(`(experience|years|worked|familiar|proficien|knowledge).*(${re.source})|(${re.source}).*(experience|years)`, 'i'),
    text: yrs(n), pick: YES,
  })),
  // general software experience counts as total
  { q: /experience.*(software|development|engineering|programming|coding|it industry)/i, text: yrs(ME.totalExp), pick: YES },
  // experience with an unlisted skill: leave for you to answer
  { q: /experience (with|in|using|working with|on)\s+\S|years.*(with|in|using)\s+\S/i, text: null },
  { q: /total.*experience|experience.*total|years of (work |professional |relevant )?experience|how many years/i,
    text: yrs(ME.totalExp) },

  // current job
  { q: /current(ly)? (employer|company|organi[sz]ation)/i, text: ME.company },
  { q: /current (job )?(title|designation|role|position)/i, text: ME.title },
  { q: /currently (employed|working)/i, text: 'Yes', pick: YES },

  // education
  { q: /highest.*(education|qualification|degree)|level of education/i,
    text: 'Bachelor\'s (B.Tech)', pick: /bachelor|b\.?\s?tech|b\.?e\b|graduat|undergrad/i },
  { q: /degree|qualification/i, text: ME.degree, pick: /bachelor|b\.?\s?tech|b\.?e\b/i },
  { q: /university|college|institut/i, text: ME.college },
  { q: /graduat.*year|year of (passing|graduation)|passing year/i, text: ME.gradYear, pick: /2024/ },
  { q: /cgpa|\bgpa\b/i, text: ME.cgpa },

  // logistics
  { q: /current (city|location)|where.*(based|located|live)|your (city|location)|^city|^location/i, text: ME.city },
  { q: /remote|work from home|wfh/i, text: 'Yes', pick: YES },
  { q: /authori[sz]ed to work in india|indian citizen|eligible to work in india/i, text: 'Yes', pick: YES },
  { q: /sponsorship|visa/i, text: 'No', pick: NO },
  { q: /hear about|how did you find|source/i, text: 'Indeed', pick: /indeed|job (board|portal)/i },

  // cover note
  { q: /cover letter|why (are you|do you want|should we)|about yourself|summary/i,
    text: `Hi, I'm a Software Engineer with ${ME.totalExp} years of experience at ${ME.company}, where I rebuilt a legacy dispatch platform in React.js and built real-time Socket.IO workflows. I've also built a full-stack platform with Next.js, FastAPI, Celery and PostgreSQL serving 400+ users, and I'm a Codeforces Expert (1645). I'd love to bring that to this role. Thanks for considering my application.` },
];
