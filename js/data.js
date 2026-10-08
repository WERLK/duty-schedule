/**
 * 数据管理模块
 * 支持多班级：顶层为 classes 数组 + currentClassId
 * getData() 返回当前班级数据，保持向后兼容
 */

const STORAGE_KEY = 'class_duty_system_v2';

function getDefaultClass(name = '默认班级') {
  return {
    id: uid(),
    name,
    cycle: 'weekday', // weekday | week
    students: [],     // {id, name, gender, group, unavailableDays:[]}
    tasks: [],        // {id, name, count, icon}
    schedules: {}     // { "2024-W01": { days: {...} } }
  };
}

function getDefaultData() {
  const cls = getDefaultClass('我的班级');
  return {
    currentClassId: cls.id,
    classes: [cls]
  };
}

let state = loadData();

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      // 数据迁移：旧版 v1 结构 -> v2 多班级结构
      if (!data.classes && data.students !== undefined) {
        const cls = getDefaultClass(data.className || '我的班级');
        cls.cycle = data.cycle || 'weekday';
        cls.students = data.students || [];
        cls.tasks = data.tasks || [];
        cls.schedules = data.schedules || {};
        return { currentClassId: cls.id, classes: [cls] };
      }
      // 确保每个班级字段完整
      data.classes = (data.classes || []).map(c => ({
        ...getDefaultClass(''),
        ...c,
        students: (c.students || []).map(s => ({ unavailableDays: [], ...s }))
      }));
      if (!data.currentClassId && data.classes.length > 0) {
        data.currentClassId = data.classes[0].id;
      }
      if (data.classes.length === 0) {
        return getDefaultData();
      }
      return data;
    }
  } catch (e) {
    console.error('加载数据失败', e);
  }
  return getDefaultData();
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('保存数据失败', e);
  }
}

// === ID 生成 ===
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// === 当前班级 ===
function getData() {
  return getCurrentClass();
}

function getCurrentClass() {
  return state.classes.find(c => c.id === state.currentClassId) || state.classes[0];
}

function setCurrentClass(id) {
  if (state.classes.find(c => c.id === id)) {
    state.currentClassId = id;
    saveData();
  }
}

function getClasses() {
  return state.classes;
}

function getClassById(id) {
  return state.classes.find(c => c.id === id);
}

function addClass(name) {
  const cls = getDefaultClass(name || '新班级');
  state.classes.push(cls);
  state.currentClassId = cls.id;
  saveData();
  return cls;
}

function updateClass(id, name, cycle) {
  const c = getClassById(id);
  if (c) {
    if (name !== undefined) c.name = name;
    if (cycle !== undefined) c.cycle = cycle;
    saveData();
  }
}

function deleteClass(id) {
  if (state.classes.length <= 1) {
    toast('至少保留一个班级');
    return;
  }
  state.classes = state.classes.filter(c => c.id !== id);
  if (state.currentClassId === id) {
    state.currentClassId = state.classes[0].id;
  }
  saveData();
}

// === 班级设置（兼容旧接口，操作当前班级）===
function updateClassName(name) {
  const c = getCurrentClass();
  c.name = name;
  saveData();
}

function updateCycle(cycle) {
  getCurrentClass().cycle = cycle;
  saveData();
}

// === 学生管理（操作当前班级）===
function addStudent(name, gender, group, unavailableDays) {
  getCurrentClass().students.push({
    id: uid(), name: name.trim(), gender: gender || '男',
    group: group || '', unavailableDays: unavailableDays || []
  });
  saveData();
}

function updateStudent(id, name, gender, group, unavailableDays) {
  const s = getCurrentClass().students.find(x => x.id === id);
  if (s) {
    s.name = name.trim();
    s.gender = gender;
    s.group = group || '';
    s.unavailableDays = unavailableDays || [];
    saveData();
  }
}

function deleteStudent(id) {
  const cls = getCurrentClass();
  cls.students = cls.students.filter(x => x.id !== id);
  Object.values(cls.schedules).forEach(week => {
    Object.values(week.days).forEach(tasks => {
      tasks.forEach(t => { t.studentIds = t.studentIds.filter(sid => sid !== id); });
    });
  });
  saveData();
}

function getStudentById(id) {
  return getCurrentClass().students.find(x => x.id === id);
}

// === 任务管理（操作当前班级）===
function addTask(name, count, icon) {
  getCurrentClass().tasks.push({ id: uid(), name: name.trim(), count: parseInt(count) || 1, icon: icon || '🧹' });
  saveData();
}

function updateTask(id, name, count, icon) {
  const t = getCurrentClass().tasks.find(x => x.id === id);
  if (t) {
    t.name = name.trim();
    t.count = parseInt(count) || 1;
    t.icon = icon || '🧹';
    saveData();
  }
}

function deleteTask(id) {
  const cls = getCurrentClass();
  cls.tasks = cls.tasks.filter(x => x.id !== id);
  Object.values(cls.schedules).forEach(week => {
    Object.values(week.days).forEach(tasks => {
      const idx = tasks.findIndex(t => t.taskId === id);
      if (idx >= 0) tasks.splice(idx, 1);
    });
  });
  saveData();
}

function getTaskById(id) {
  return getCurrentClass().tasks.find(x => x.id === id);
}

// === 值日表管理（操作当前班级）===
function getSchedule(weekKey) {
  return getCurrentClass().schedules[weekKey];
}

function setSchedule(weekKey, schedule) {
  getCurrentClass().schedules[weekKey] = schedule;
  saveData();
}

function getAllSchedules() {
  return getCurrentClass().schedules;
}

// === 导入导出 ===
function exportJSON() {
  return JSON.stringify(state, null, 2);
}

function importJSON(jsonStr) {
  const data = JSON.parse(jsonStr);
  // 兼容导入单个班级数据
  if (!data.classes && data.students !== undefined) {
    const cls = getDefaultClass(data.className || '导入班级');
    cls.cycle = data.cycle || 'weekday';
    cls.students = data.students || [];
    cls.tasks = data.tasks || [];
    cls.schedules = data.schedules || {};
    state = { currentClassId: cls.id, classes: [cls] };
  } else {
    state = { ...getDefaultData(), ...data };
  }
  saveData();
}

function clearAll() {
  state = getDefaultData();
  saveData();
}

// === 统计：某学生累计值日次数 ===
function getStudentDutyCount(studentId) {
  let count = 0;
  Object.values(getCurrentClass().schedules).forEach(week => {
    Object.values(week.days).forEach(tasks => {
      tasks.forEach(t => { if (t.studentIds.includes(studentId)) count++; });
    });
  });
  return count;
}
