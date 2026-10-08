/**
 * 排班算法模块
 * 支持：公平分配、按小组轮换、学生不可值日日期、自定义参与学生、节假日排除
 */

const WEEKDAY_MAP = { '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 0 };

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekKey(date) {
  const monday = getMonday(date);
  const year = monday.getFullYear();
  const firstDay = new Date(year, 0, 1);
  const weekNum = Math.ceil((((monday - firstDay) / 86400000) + firstDay.getDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

function getWeekRangeText(date) {
  const monday = getMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${monday.getMonth() + 1}月${monday.getDate()}日 - ${sunday.getMonth() + 1}月${sunday.getDate()}日`;
}

function getDutyDays() {
  const cycle = getData().cycle;
  if (cycle === 'week') return ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  return ['周一', '周二', '周三', '周四', '周五'];
}

/**
 * 获取周内某天的具体日期对象
 */
function getDateOfWeekday(weekMonday, dayName) {
  const idx = WEEKDAY_MAP[dayName];
  const d = new Date(weekMonday);
  d.setDate(weekMonday.getDate() + (idx === 0 ? 6 : idx - 1));
  return d;
}

/**
 * 简易中国法定节假日判断（2024-2026 主要节假日）
 * 返回 true 表示该天为节假日，应排除
 */
const HOLIDAYS = new Set([
  // 2024
  '2024-01-01','2024-02-10','2024-02-11','2024-02-12','2024-02-13','2024-02-14','2024-02-15','2024-02-16','2024-02-17',
  '2024-04-04','2024-04-05','2024-04-06','2024-05-01','2024-05-02','2024-05-03','2024-05-04','2024-05-05',
  '2024-06-10','2024-09-15','2024-09-16','2024-09-17','2024-10-01','2024-10-02','2024-10-03','2024-10-04','2024-10-05','2024-10-06','2024-10-07',
  // 2025
  '2025-01-01','2025-01-28','2025-01-29','2025-01-30','2025-01-31','2025-02-01','2025-02-02','2025-02-03','2025-02-04',
  '2025-04-04','2025-04-05','2025-04-06','2025-05-01','2025-05-02','2025-05-03','2025-05-04','2025-05-05',
  '2025-05-31','2025-06-01','2025-06-02','2025-10-01','2025-10-02','2025-10-03','2025-10-04','2025-10-05','2025-10-06','2025-10-07','2025-10-08',
  // 2026
  '2026-01-01','2026-01-02','2026-01-03','2026-02-17','2026-02-18','2026-02-19','2026-02-20','2026-02-21','2026-02-22','2026-02-23',
  '2026-04-05','2026-04-06','2026-05-01','2026-05-02','2026-05-03','2026-06-19','2026-06-20','2026-06-21',
  '2026-10-01','2026-10-02','2026-10-03','2026-10-04','2026-10-05','2026-10-06','2026-10-07'
]);

function isHoliday(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return HOLIDAYS.has(`${y}-${m}-${d}`);
}

/**
 * 生成指定周的值日表
 * @param {string} weekKey
 * @param {Date} weekDate - 该周任意一天
 * @param {Object} options - { studentIds: [], mode: 'fair'|'group', excludeHoliday: true, days: [] }
 */
function generateWeekSchedule(weekKey, weekDate, options = {}) {
  const data = getData();
  const allStudents = data.students;
  const tasks = data.tasks;
  const days = options.days && options.days.length ? options.days : getDutyDays();

  // 参与学生
  let students = options.studentIds && options.studentIds.length
    ? allStudents.filter(s => options.studentIds.includes(s.id))
    : allStudents;

  if (students.length === 0 || tasks.length === 0) return null;

  const monday = getMonday(weekDate);
  const excludeHoliday = options.excludeHoliday !== false;

  // 过滤掉节假日（在生成的值日表中标记为空）
  const activeDays = days.filter(d => {
    if (!excludeHoliday) return true;
    const dt = getDateOfWeekday(monday, d);
    return !isHoliday(dt);
  });

  // 计算每位学生的累计值日次数
  const dutyCounts = {};
  students.forEach(s => { dutyCounts[s.id] = getStudentDutyCount(s.id); });

  const schedule = { days: {} };

  // 按小组轮换模式：将学生按小组分组，每天轮流用不同小组
  const mode = options.mode || 'fair';
  let groupRotateIndex = 0;
  const groups = {};
  if (mode === 'group') {
    students.forEach(s => {
      const g = s.group || '未分组';
      if (!groups[g]) groups[g] = [];
      groups[g].push(s);
    });
  }

  activeDays.forEach((day, dayIdx) => {
    schedule.days[day] = [];
    const dayAssigned = new Set();

    tasks.forEach(task => {
      const needed = task.count;
      let pool;

      if (mode === 'group' && Object.keys(groups).length > 0) {
        // 按小组轮换：每天优先从不同小组选人
        const groupKeys = Object.keys(groups);
        const startIdx = (dayIdx + groupRotateIndex) % groupKeys.length;
        let ordered = [];
        for (let i = 0; i < groupKeys.length; i++) {
          ordered = ordered.concat(groups[groupKeys[(startIdx + i) % groupKeys.length]]);
        }
        pool = ordered.filter(s => !dayAssigned.has(s.id));
        groupRotateIndex++;
      } else {
        // 公平模式：按值日次数升序
        pool = students
          .filter(s => !dayAssigned.has(s.id))
          .sort((a, b) => dutyCounts[a.id] - dutyCounts[b.id]);
      }

      // 排除当天不可值日的学生
      pool = pool.filter(s => !(s.unavailableDays || []).includes(day));

      let selected = pool.slice(0, needed);

      // 人不够时，从全部候选中补充（含已安排和不可值日的，优先未安排且可值日的）
      if (selected.length < needed) {
        const fallback = students
          .filter(s => !selected.find(x => x.id === s.id))
          .filter(s => !(s.unavailableDays || []).includes(day))
          .sort((a, b) => dutyCounts[a.id] - dutyCounts[b.id]);
        selected = selected.concat(fallback.slice(0, needed - selected.length));
      }
      // 实在不够就放宽限制
      if (selected.length < needed) {
        const finalFallback = students
          .filter(s => !selected.find(x => x.id === s.id))
          .sort((a, b) => dutyCounts[a.id] - dutyCounts[b.id]);
        selected = selected.concat(finalFallback.slice(0, needed - selected.length));
      }

      const studentIds = selected.map(s => s.id);
      selected.forEach(s => {
        dutyCounts[s.id]++;
        dayAssigned.add(s.id);
      });

      schedule.days[day].push({ taskId: task.id, studentIds });
    });
  });

  // 节假日也保留 key，但 tasks 为空数组
  days.forEach(d => {
    if (!schedule.days[d]) schedule.days[d] = [];
  });

  return schedule;
}

/**
 * 生成未来N周值日表
 */
function generateSchedules(weekCount = 4, options = {}) {
  const today = new Date();
  const monday = getMonday(today);
  const results = [];
  for (let i = 0; i < weekCount; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i * 7);
    const weekKey = getWeekKey(date);
    const schedule = generateWeekSchedule(weekKey, date, options);
    if (schedule) {
      setSchedule(weekKey, schedule);
      results.push({ weekKey, date });
    }
  }
  return results;
}
