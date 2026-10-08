/**
 * 主应用逻辑
 * 多班级、自定义排班、双视图、导出图片、不可值日日期
 */

let editingStudentId = null;
let editingTaskId = null;
let currentTab = 'dashboard';
let currentWeekType = 'this';
let currentWeekKey = null;
let adjustContext = null;
let scheduleView = 'task'; // task | day

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
  switchTab('dashboard');
  renderClassSelector();
  initWeekSelectors();
  renderAll();
});

function renderAll() {
  renderClassSelector();
  renderStudents();
  renderSchedule();
  renderDashboard();
  renderGroupFilter();
}

// ========== 标签页切换 ==========
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(sec => {
    sec.classList.toggle('hidden', sec.id !== `tab-${tab}`);
  });
  if (tab === 'schedule') renderSchedule();
  if (tab === 'dashboard') renderDashboard();
}

// ========== Toast ==========
function toast(msg) {
  const el = document.getElementById('toast');
  document.getElementById('toastText').textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2000);
}

// ========== 弹窗控制 ==========
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', (e) => { if (e.target === m) m.classList.add('hidden'); });
});

// ========== 班级管理 ==========
function renderClassSelector() {
  const sel = document.getElementById('classSelector');
  const classes = getClasses();
  const current = getCurrentClass();
  sel.innerHTML = classes.map(c =>
    `<option value="${c.id}" ${c.id === current.id ? 'selected' : ''}>${c.name}</option>`
  ).join('');
}

function onClassChange(id) {
  setCurrentClass(id);
  initWeekSelectors();
  renderAll();
}

function openClassManager() {
  renderClassList();
  openModal('classManagerModal');
}

function renderClassList() {
  const classes = getClasses();
  const list = document.getElementById('classList');
  list.innerHTML = classes.map(c => `
    <div class="flex items-center gap-2 p-2 border border-slate-100 rounded-lg">
      <span class="flex-1 font-medium text-slate-700">${c.name}</span>
      <span class="text-xs text-slate-400">${c.students.length}人</span>
      <button onclick="renameClass('${c.id}')" class="text-xs text-primary-600 hover:underline">重命名</button>
      <button onclick="deleteClassAction('${c.id}')" class="text-xs text-red-500 hover:underline">删除</button>
    </div>
  `).join('');
}

function addClassAction() {
  const name = document.getElementById('newClassName').value.trim();
  if (!name) { toast('请输入班级名称'); return; }
  addClass(name);
  document.getElementById('newClassName').value = '';
  renderClassList();
  renderClassSelector();
  toast('班级已创建');
}

function renameClass(id) {
  const c = getClassById(id);
  const name = prompt('输入新的班级名称', c.name);
  if (name && name.trim()) {
    updateClass(id, name.trim());
    renderClassList();
    renderClassSelector();
    toast('已重命名');
  }
}

function deleteClassAction(id) {
  const c = getClassById(id);
  if (confirm(`确定删除班级「${c.name}」吗？该班级所有数据将丢失！`)) {
    deleteClass(id);
    renderClassList();
    renderClassSelector();
    initWeekSelectors();
    renderAll();
    toast('已删除');
  }
}

// ========== 概览页 ==========
function renderDashboard() {
  const data = getData();
  document.getElementById('statStudents').textContent = data.students.length;
  document.getElementById('statTasks').textContent = data.tasks.length;

  const weekKey = getWeekKey(new Date());
  const weekSchedule = getSchedule(weekKey);
  let count = 0;
  if (weekSchedule) {
    Object.values(weekSchedule.days).forEach(tasks => {
      tasks.forEach(t => { count += t.studentIds.length; });
    });
  }
  document.getElementById('statDutyCount').textContent = count;

  const preview = document.getElementById('dashboardSchedule');
  if (weekSchedule) {
    let html = '<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="bg-slate-50 text-slate-600">';
    getDutyDays().forEach(d => { html += `<th class="px-3 py-2 text-left font-medium">${d}</th>`; });
    html += '</tr></thead><tbody>';
    data.tasks.forEach(task => {
      html += '<tr class="border-t border-slate-100">';
      getDutyDays().forEach(day => {
        const dayTasks = weekSchedule.days[day] || [];
        const taskEntry = dayTasks.find(t => t.taskId === task.id);
        const names = taskEntry ? taskEntry.studentIds.map(sid => getStudentById(sid)?.name || '?').join('、') : '';
        html += `<td class="px-3 py-2 align-top"><div class="text-xs text-slate-400">${task.icon} ${task.name}</div><div class="mt-1">${names}</div></td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    preview.innerHTML = html;
  } else {
    preview.innerHTML = '<span class="text-slate-400">暂无数据，请先到「值日表」页面生成</span>';
  }
}

// ========== 学生管理 ==========
function openAddStudent() {
  editingStudentId = null;
  document.getElementById('studentModalTitle').textContent = '添加学生';
  document.getElementById('studentName').value = '';
  document.querySelector('input[name="studentGender"][value="男"]').checked = true;
  document.getElementById('studentGroup').value = '';
  document.querySelectorAll('.ud-cb').forEach(cb => cb.checked = false);
  openModal('studentModal');
  setTimeout(() => document.getElementById('studentName').focus(), 100);
}

function openEditStudent(id) {
  const s = getStudentById(id);
  if (!s) return;
  editingStudentId = id;
  document.getElementById('studentModalTitle').textContent = '编辑学生';
  document.getElementById('studentName').value = s.name;
  document.querySelector(`input[name="studentGender"][value="${s.gender}"]`).checked = true;
  document.getElementById('studentGroup').value = s.group || '';
  const ud = s.unavailableDays || [];
  document.querySelectorAll('.ud-cb').forEach(cb => { cb.checked = ud.includes(cb.value); });
  openModal('studentModal');
}

function saveStudent() {
  const name = document.getElementById('studentName').value.trim();
  if (!name) { toast('请输入学生姓名'); return; }
  const gender = document.querySelector('input[name="studentGender"]:checked').value;
  const group = document.getElementById('studentGroup').value.trim();
  const unavailableDays = [...document.querySelectorAll('.ud-cb:checked')].map(cb => cb.value);

  if (editingStudentId) {
    updateStudent(editingStudentId, name, gender, group, unavailableDays);
    toast('已更新');
  } else {
    addStudent(name, gender, group, unavailableDays);
    toast('已添加');
  }
  closeModal('studentModal');
  renderAll();
}

function confirmDeleteStudent(id) {
  const s = getStudentById(id);
  if (confirm(`确定删除学生「${s.name}」吗？`)) {
    deleteStudent(id);
    toast('已删除');
    renderAll();
  }
}

function renderGroupFilter() {
  const groups = [...new Set(getData().students.map(s => s.group).filter(Boolean))];
  const sel = document.getElementById('studentGroupFilter');
  const current = sel.value;
  sel.innerHTML = '<option value="">全部小组</option>' + groups.map(g => `<option value="${g}">${g}</option>`).join('');
  sel.value = current;
}

function renderStudents() {
  const data = getData();
  const search = document.getElementById('studentSearch').value.trim().toLowerCase();
  const groupFilter = document.getElementById('studentGroupFilter').value;

  let list = data.students;
  if (search) list = list.filter(s => s.name.toLowerCase().includes(search));
  if (groupFilter) list = list.filter(s => s.group === groupFilter);

  const tbody = document.getElementById('studentsTableBody');
  const empty = document.getElementById('studentsEmpty');

  if (list.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = list.map((s, i) => {
    const count = getStudentDutyCount(s.id);
    const ud = (s.unavailableDays || []).join('、') || '-';
    return `
      <tr class="hover:bg-slate-50">
        <td class="px-4 py-3 text-slate-500">${i + 1}</td>
        <td class="px-4 py-3 font-medium text-slate-800">${s.name}</td>
        <td class="px-4 py-3">
          <span class="px-2 py-0.5 rounded-full text-xs ${s.gender === '男' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}">${s.gender}</span>
        </td>
        <td class="px-4 py-3 text-slate-600">${s.group || '-'}</td>
        <td class="px-4 py-3 text-slate-500 text-xs" title="不可值日">${ud}</td>
        <td class="px-4 py-3"><span class="font-semibold text-amber-600">${count}</span> 次</td>
        <td class="px-4 py-3 text-right">
          <button onclick="openEditStudent('${s.id}')" class="text-primary-600 hover:text-primary-700 mr-3 text-sm">编辑</button>
          <button onclick="confirmDeleteStudent('${s.id}')" class="text-red-500 hover:text-red-600 text-sm">删除</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openBatchAddStudents() {
  document.getElementById('batchStudentText').value = '';
  openModal('batchStudentModal');
}

function saveBatchStudents() {
  const text = document.getElementById('batchStudentText').value.trim();
  if (!text) { toast('请输入学生信息'); return; }
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let added = 0;
  lines.forEach(line => {
    const parts = line.split(/[,，]/).map(p => p.trim());
    const name = parts[0];
    const gender = parts[1] || '男';
    const group = parts[2] || '';
    if (name) { addStudent(name, gender, group, []); added++; }
  });
  closeModal('batchStudentModal');
  toast(`已添加 ${added} 名学生`);
  renderAll();
}

// ========== 任务管理 ==========
function openAddTask() {
  editingTaskId = null;
  document.getElementById('taskModalTitle').textContent = '添加任务';
  document.getElementById('taskName').value = '';
  document.getElementById('taskCount').value = 1;
  document.getElementById('taskIcon').value = '🧹';
  openModal('taskModal');
  setTimeout(() => document.getElementById('taskName').focus(), 100);
}

function openEditTask(id) {
  const t = getTaskById(id);
  if (!t) return;
  editingTaskId = id;
  document.getElementById('taskModalTitle').textContent = '编辑任务';
  document.getElementById('taskName').value = t.name;
  document.getElementById('taskCount').value = t.count;
  document.getElementById('taskIcon').value = t.icon;
  openModal('taskModal');
}

function saveTask() {
  const name = document.getElementById('taskName').value.trim();
  if (!name) { toast('请输入任务名称'); return; }
  const count = document.getElementById('taskCount').value;
  const icon = document.getElementById('taskIcon').value.trim() || '🧹';

  if (editingTaskId) { updateTask(editingTaskId, name, count, icon); toast('已更新'); }
  else { addTask(name, count, icon); toast('已添加'); }
  closeModal('taskModal');
  renderAll();
  // 如果设置弹窗打开，刷新任务列表
  if (!document.getElementById('settingsModal').classList.contains('hidden')) {
    renderSettingTasks();
  }
}

function confirmDeleteTask(id) {
  const t = getTaskById(id);
  if (confirm(`确定删除任务「${t.name}」吗？`)) {
    deleteTask(id);
    toast('已删除');
    renderAll();
    if (!document.getElementById('settingsModal').classList.contains('hidden')) {
      renderSettingTasks();
    }
  }
}

/**
 * 在设置弹窗中渲染任务列表
 */
function renderSettingTasks() {
  const tasks = getData().tasks;
  const list = document.getElementById('settingTasksList');
  if (tasks.length === 0) {
    list.innerHTML = '<div class="text-sm text-slate-400 py-2 text-center">暂无任务，点击上方"添加任务"</div>';
    return;
  }
  list.innerHTML = tasks.map(t => `
    <div class="flex items-center gap-2 p-2 border border-slate-100 rounded-lg">
      <span class="text-xl">${t.icon}</span>
      <span class="flex-1 text-sm font-medium text-slate-700">${t.name}</span>
      <span class="text-xs text-slate-500">${t.count}人</span>
      <button onclick="openEditTask('${t.id}')" class="text-xs text-primary-600 hover:underline">编辑</button>
      <button onclick="confirmDeleteTask('${t.id}')" class="text-xs text-red-500 hover:underline">删除</button>
    </div>
  `).join('');
}

// ========== 值日表 ==========
function initWeekSelectors() {
  const sel = document.getElementById('scheduleWeekRange');
  const monday = getMonday(new Date());
  sel.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i * 7);
    const key = getWeekKey(d);
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `第 ${i === 0 ? '本周' : i + '周后'}（${getWeekRangeText(d)}）`;
    opt.dataset.date = d.toISOString();
    sel.appendChild(opt);
  }
  currentWeekKey = sel.value;
  onWeekTypeChange();
}

function onWeekTypeChange() {
  currentWeekType = document.getElementById('scheduleWeekType').value;
  const sel = document.getElementById('scheduleWeekRange');
  if (currentWeekType === 'this') sel.selectedIndex = 0;
  else sel.selectedIndex = Math.min(1, sel.options.length - 1);
  currentWeekKey = sel.value;
  renderSchedule();
}

function setScheduleView(view) {
  scheduleView = view;
  document.getElementById('viewTaskBtn').className = `px-3 py-1.5 text-xs rounded-md font-medium ${view === 'task' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'}`;
  document.getElementById('viewDayBtn').className = `px-3 py-1.5 text-xs rounded-md font-medium ${view === 'day' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'}`;
  renderSchedule();
}

function renderSchedule() {
  const sel = document.getElementById('scheduleWeekRange');
  currentWeekKey = sel.value;
  const data = getData();
  const schedule = getSchedule(currentWeekKey);
  const container = document.getElementById('scheduleContainer');
  const empty = document.getElementById('scheduleEmpty');
  const days = getDutyDays();

  const date = new Date(sel.options[sel.selectedIndex].dataset.date);
  document.getElementById('scheduleWeekInfo').textContent = `${currentWeekKey}（${getWeekRangeText(date)}）`;

  let tip = '';
  if (data.students.length === 0) tip = '请先添加学生';
  else if (data.tasks.length === 0) tip = '请先设置值日任务';
  document.getElementById('scheduleTip').textContent = tip;

  if (!schedule) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  // 判断是否节假日
  const monday = getMonday(date);
  const isDayHoliday = {};
  days.forEach(d => { isDayHoliday[d] = isHoliday(getDateOfWeekday(monday, d)); });

  if (scheduleView === 'task') {
    renderScheduleByTask(data, schedule, days, isDayHoliday, monday);
  } else {
    renderScheduleByDay(data, schedule, days, isDayHoliday, monday);
  }
}

function renderScheduleByTask(data, schedule, days, isDayHoliday, monday) {
  const container = document.getElementById('scheduleContainer');
  let html = '<table class="w-full text-sm min-w-[600px]"><thead><tr class="bg-slate-100 text-slate-700">';
  html += '<th class="px-4 py-3 text-left font-medium sticky left-0 bg-slate-100 z-10 w-28">任务</th>';
  days.forEach(d => {
    const hd = isDayHoliday[d] ? ' text-red-500' : '';
    html += `<th class="px-4 py-3 text-center font-medium${hd}">${d}${isDayHoliday[d] ? '<br><span class="text-xs">休</span>' : ''}</th>`;
  });
  html += '</tr></thead><tbody>';

  data.tasks.forEach(task => {
    html += `<tr class="border-t border-slate-100">`;
    html += `<td class="px-4 py-3 sticky left-0 bg-white z-10">
      <div class="flex items-center gap-2">
        <span class="text-xl">${task.icon}</span>
        <div><div class="font-medium text-slate-800">${task.name}</div><div class="text-xs text-slate-400">${task.count}人</div></div>
      </div>
    </td>`;
    days.forEach((day, dayIdx) => {
      const dayTasks = schedule.days[day] || [];
      const entry = dayTasks.find(t => t.taskId === task.id);
      html += `<td class="px-2 py-2 schedule-cell align-top ${isDayHoliday[day] ? 'bg-red-50/40' : ''}">`;
      if (entry) {
        entry.studentIds.forEach(sid => {
          const s = getStudentById(sid);
          const name = s ? s.name : '?';
          html += `<span class="duty-chip" onclick="openAdjust('${currentWeekKey}','${day}',${dayTasks.indexOf(entry)})" title="点击调整">${name} ✏️</span>`;
        });
      } else if (isDayHoliday[day]) {
        html += `<span class="text-xs text-red-400">节假日</span>`;
      }
      html += `</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderScheduleByDay(data, schedule, days, isDayHoliday, monday) {
  const container = document.getElementById('scheduleContainer');
  let html = '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 p-4">';
  days.forEach(day => {
    const dayTasks = schedule.days[day] || [];
    html += `<div class="border border-slate-200 rounded-xl p-4 ${isDayHoliday[day] ? 'bg-red-50/40' : 'bg-white'}">
      <div class="font-bold text-slate-800 mb-2 flex items-center justify-between">
        <span>${day}</span>
        ${isDayHoliday[day] ? '<span class="text-xs text-red-500 bg-red-100 px-2 py-0.5 rounded-full">休</span>' : ''}
      </div>`;
    if (dayTasks.length === 0) {
      html += `<div class="text-xs text-slate-400 py-4 text-center">${isDayHoliday[day] ? '节假日' : '无安排'}</div>`;
    } else {
      dayTasks.forEach(t => {
        const task = getTaskById(t.taskId);
        if (!task) return;
        html += `<div class="mb-2">
          <div class="text-xs text-slate-500 mb-1">${task.icon} ${task.name}（${task.count}人）</div>
          <div class="flex flex-wrap gap-1">`;
        t.studentIds.forEach(sid => {
          const s = getStudentById(sid);
          html += `<span class="duty-chip" onclick="openAdjust('${currentWeekKey}','${day}',${dayTasks.indexOf(t)})">${s ? s.name : '?'} ✏️</span>`;
        });
        html += `</div></div>`;
      });
    }
    html += `</div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

// ========== 自定义排班弹窗 ==========
function openGenerateModal() {
  const data = getData();
  if (data.students.length === 0) { toast('请先添加学生'); switchTab('students'); return; }
  if (data.tasks.length === 0) { toast('请先在设置中添加值日任务'); openSettings(); return; }

  // 填充班级选择
  const sel = document.getElementById('genClassId');
  sel.innerHTML = getClasses().map(c =>
    `<option value="${c.id}" ${c.id === getCurrentClass().id ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  document.getElementById('genExcludeHoliday').checked = true;
  document.getElementById('genWeekCount').value = '4';
  document.querySelector('input[name="genMode"][value="fair"]').checked = true;

  renderGenStudentList();
  openModal('generateModal');
}

function onGenClassChange() {
  const classId = document.getElementById('genClassId').value;
  // 临时切换到该班级以读取学生
  const prevId = getCurrentClass().id;
  setCurrentClass(classId);
  renderGenStudentList();
  // 不恢复，让排班在选中班级进行
}

function renderGenStudentList() {
  const students = getData().students;
  const list = document.getElementById('genStudentList');
  list.innerHTML = students.map(s => `
    <label class="flex items-center gap-1.5 cursor-pointer px-2 py-1.5 border border-slate-100 rounded-lg hover:bg-slate-50">
      <input type="checkbox" class="gen-stu-cb accent-primary-600" value="${s.id}" checked onchange="updateGenSelectedCount()" />
      <span class="text-sm text-slate-700">${s.name}</span>
      ${s.group ? `<span class="text-xs text-slate-400">${s.group}</span>` : ''}
    </label>
  `).join('');
  updateGenSelectedCount();
}

function updateGenSelectedCount() {
  const n = document.querySelectorAll('.gen-stu-cb:checked').length;
  document.getElementById('genSelectedCount').textContent = n;
}

function selectAllGenStudents(checked) {
  document.querySelectorAll('.gen-stu-cb').forEach(cb => cb.checked = checked);
  updateGenSelectedCount();
}

function confirmGenerate() {
  const classId = document.getElementById('genClassId').value;
  const mode = document.querySelector('input[name="genMode"]:checked').value;
  const excludeHoliday = document.getElementById('genExcludeHoliday').checked;
  const weekCount = parseInt(document.getElementById('genWeekCount').value);
  const studentIds = [...document.querySelectorAll('.gen-stu-cb:checked')].map(cb => cb.value);

  if (studentIds.length === 0) { toast('请至少选择一名学生'); return; }

  setCurrentClass(classId);
  const results = generateSchedules(weekCount, { studentIds, mode, excludeHoliday });

  closeModal('generateModal');
  if (results.length > 0) {
    toast(`已生成 ${results.length} 周值日表`);
    initWeekSelectors();
    renderAll();
  } else {
    toast('生成失败');
  }
}

// ========== 调整值日人员 ==========
function openAdjust(weekKey, day, taskIndex) {
  const schedule = getSchedule(weekKey);
  if (!schedule) return;
  const entry = schedule.days[day][taskIndex];
  const task = getTaskById(entry.taskId);
  adjustContext = { weekKey, day, taskIndex, currentIds: [...entry.studentIds] };

  document.getElementById('adjustInfo').textContent = `${day} · ${task.icon} ${task.name}（需 ${task.count} 人）`;

  const list = document.getElementById('adjustStudentList');
  const students = getData().students;
  list.innerHTML = students.map(s => {
    const checked = entry.studentIds.includes(s.id) ? 'checked' : '';
    const ud = (s.unavailableDays || []).includes(day);
    return `
      <label class="flex items-center gap-3 p-2 border ${ud ? 'border-amber-200 bg-amber-50' : 'border-slate-100'} rounded-lg cursor-pointer hover:bg-slate-50">
        <input type="checkbox" class="adjust-student-cb w-4 h-4 accent-primary-600" value="${s.id}" ${checked} />
        <span class="font-medium text-slate-700">${s.name}</span>
        <span class="text-xs text-slate-400">${s.group || ''}</span>
        ${ud ? '<span class="text-xs text-amber-600">该生本日不可值日</span>' : ''}
        <span class="ml-auto text-xs text-amber-600">值日 ${getStudentDutyCount(s.id)} 次</span>
      </label>
    `;
  }).join('');

  openModal('adjustModal');
}

function saveAdjust() {
  if (!adjustContext) return;
  const checked = [...document.querySelectorAll('.adjust-student-cb:checked')].map(cb => cb.value);
  if (checked.length === 0) { toast('请至少选择一名学生'); return; }

  const { weekKey, day, taskIndex } = adjustContext;
  const schedule = getSchedule(weekKey);
  schedule.days[day][taskIndex].studentIds = checked;
  setSchedule(weekKey, schedule);

  closeModal('adjustModal');
  toast('已调整');
  renderAll();
}

// ========== 值日统计 ==========
// ========== 设置 ==========
function openSettings() {
  const data = getData();
  document.getElementById('settingClassName').value = data.name || '';
  document.getElementById('settingCycle').value = data.cycle;
  renderSettingTasks();
  openModal('settingsModal');
}

function saveSettings() {
  const name = document.getElementById('settingClassName').value.trim();
  const cycle = document.getElementById('settingCycle').value;
  updateClassName(name);
  updateCycle(cycle);
  closeModal('settingsModal');
  toast('设置已保存');
  renderAll();
}

// ========== 导入导出 ==========
function exportData() {
  const json = exportJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `班级值日表数据_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      importJSON(e.target.result);
      toast('导入成功');
      renderClassSelector();
      renderAll();
    } catch (err) {
      toast('导入失败：文件格式错误');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function clearAllData() {
  if (confirm('确定清空所有数据吗？此操作不可恢复！')) {
    clearAll();
    toast('已清空所有数据');
    closeModal('settingsModal');
    renderClassSelector();
    initWeekSelectors();
    renderAll();
  }
}

// ========== 学生导入（Excel / Word）==========

// 列名别名映射：用于智能识别 Excel 表头
const COLUMN_ALIASES = {
  name:  ['姓名', '名字', '学生姓名', '学生', 'name', 'Name', 'NAME'],
  gender:['性别', 'sex', 'Sex', 'SEX', 'gender'],
  group: ['小组', '组别', '组', 'group', 'Group', '班级小组']
};

// 性别值别名映射
const GENDER_MAP = {
  '男': '男', 'male': '男', 'Male': '男', 'M': '男', 'm': '男', '1': '男',
  '女': '女', 'female': '女', 'Female': '女', 'F': '女', 'f': '女', '0': '女'
};

// 待导入的学生数据缓存
let pendingImportStudents = [];

/**
 * 根据表头行识别列索引
 */
function detectColumns(headerRow) {
  const cols = { name: -1, gender: -1, group: -1 };
  if (!headerRow) return cols;
  headerRow.forEach((cell, idx) => {
    const val = String(cell || '').trim();
    for (const key in COLUMN_ALIASES) {
      if (COLUMN_ALIASES[key].includes(val)) {
        cols[key] = idx;
      }
    }
  });
  return cols;
}

/**
 * 智能选姓名列：扫描所有数据行，选"人名密度"最高的列
 * 彻底兜底——不管表头叫啥、有没有序号列、姓名列在哪
 */
function smartPickNameColumn(rows, startRow = 1) {
  if (!rows || rows.length <= startRow) return -1;
  const numCols = rows[startRow]?.length || 1;

  let bestCol = -1, bestScore = -1;
  for (let c = 0; c < numCols; c++) {
    let nameLike = 0, total = 0, allDigits = 0;
    for (let r = startRow; r < rows.length; r++) {
      const val = String(rows[r]?.[c] || '').trim();
      if (!val) continue;
      total++;
      if (/^\d+$/.test(val)) { allDigits++; continue; }
      // 像中文姓名：2-4字，纯中文（或含·）
      if (/^[\u4e00-\u9fa5·]{2,6}$/.test(val)) nameLike += 2;
      // 像英文名：字母+空格，2-20字符
      else if (/^[A-Za-z\s\.·]{2,20}$/.test(val)) nameLike += 1.5;
      // 普通文本，2字以上
      else if (val.length >= 2 && !/\d/.test(val)) nameLike += 0.5;
    }
    // 如果这列全是数字（序号列），跳过
    if (allDigits === total && total > 0) continue;
    // 得分 = 人名比例 * 样本量
    const score = total > 0 ? (nameLike / total) * Math.min(total, 10) : 0;
    if (score > bestScore) { bestScore = score; bestCol = c; }
  }

  // 如果没找到，兜底：跳过可能的序号列后取第一列
  if (bestCol === -1) {
    for (let c = 0; c < numCols; c++) {
      const val = String(rows[startRow]?.[c] || '').trim();
      if (val && !/^\d+$/.test(val)) return c;
    }
    bestCol = 0;
  }
  return bestCol;
}

/**
 * 标准化性别
 */
function normalizeGender(g) {
  if (!g) return '男';
  const key = String(g).trim();
  return GENDER_MAP[key] || '男';
}

/**
 * 显示导入预览弹窗
 */
function showImportPreview(students) {
  pendingImportStudents = students;
  const existingNames = new Set(getData().students.map(s => s.name));
  const tbody = document.getElementById('importPreviewBody');

  let newCount = 0, dupCount = 0;
  tbody.innerHTML = students.map((s, i) => {
    const isDup = existingNames.has(s.name);
    if (isDup) dupCount++; else newCount++;
    return `
      <tr class="${isDup ? 'bg-amber-50' : ''}">
        <td class="px-3 py-2 text-slate-500">${i + 1}</td>
        <td class="px-3 py-2 font-medium text-slate-800">${s.name}</td>
        <td class="px-3 py-2">
          <span class="px-2 py-0.5 rounded-full text-xs ${s.gender === '男' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}">${s.gender}</span>
        </td>
        <td class="px-3 py-2 text-slate-600">${s.group || '-'}</td>
        <td class="px-3 py-2 ${isDup ? 'text-amber-600' : 'text-emerald-600'}">${isDup ? '已存在（跳过）' : '新增'}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('importSummary').innerHTML =
    `共 <b>${students.length}</b> 人，其中新增 <b class="text-emerald-600">${newCount}</b> 人，重复跳过 <b class="text-amber-600">${dupCount}</b> 人`;

  openModal('importPreviewModal');
}

/**
 * 确认导入
 */
function confirmImport() {
  const existingNames = new Set(getData().students.map(s => s.name));
  let added = 0;
  pendingImportStudents.forEach(s => {
    if (!existingNames.has(s.name)) {
      addStudent(s.name, s.gender, s.group, []);
      existingNames.add(s.name);
      added++;
    }
  });
  closeModal('importPreviewModal');
  pendingImportStudents = [];
  toast(`成功导入 ${added} 名学生`);
  renderAll();
}

/**
 * 从 Excel 导入
 */
function importFromExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  toast('正在解析 Excel...');
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

      if (rows.length < 1) { toast('Excel 文件为空'); return; }

      // 检测表头列
      const headerRow = rows[0];
      const cols = detectColumns(headerRow);

      // 关键：表头没识别到 → 用智能列扫描（人名密度最高的列）
      // 表头识别到了也再验证一下——如果表头识别到的列全是数字，说明识别错了
      const nameCol = cols.name >= 0 ? cols.name : smartPickNameColumn(rows, 1);
      // 验证：如果识别到的列全是纯数字（序号列被误判），重新扫描
      let colIsAllDigits = true;
      for (let r = 1; r < Math.min(rows.length, 6); r++) {
        const v = String(rows[r]?.[nameCol] || '').trim();
        if (v && !/^\d+$/.test(v)) { colIsAllDigits = false; break; }
      }
      cols.name = colIsAllDigits ? smartPickNameColumn(rows, 1) : nameCol;

      const students = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const name = String(row[cols.name] || '').trim();
        if (!name) continue;
        // 跳过纯数字（序号）、单字
        if (/^\d+$/.test(name)) continue;
        if (name.length < 2) continue;
        const group = String(cols.group >= 0 ? (row[cols.group] || '') : '').trim();
        students.push({ name, gender: '男', group });
      }

      if (students.length === 0) { toast('未识别到有效学生数据'); return; }
      showImportPreview(students);
    } catch (err) {
      console.error(err);
      toast('Excel 解析失败，请检查文件格式');
    }
  };
  reader.readAsArrayBuffer(file);
  event.target.value = '';
}

/**
 * 从 Word / 文本导入
 */
function importFromWord(event) {
  const file = event.target.files[0];
  if (!file) return;

  const ext = file.name.split('.').pop().toLowerCase();
  toast('正在解析文档...');

  if (ext === 'txt') {
    const reader = new FileReader();
    reader.onload = (e) => parseTextAndImport(e.target.result);
    reader.readAsText(file);
  } else {
    // docx 用 mammoth 提取 HTML（保留表格结构）
    const reader = new FileReader();
    reader.onload = (e) => {
      mammoth.convertToHtml({ arrayBuffer: e.target.result })
        .then(result => {
          const students = parseWordHtml(result.value);
          if (students && students.length > 0) {
            showImportPreview(students);
          } else {
            // 没找到表格，回退到纯文本解析
            mammoth.extractRawText({ arrayBuffer: e.target.result })
              .then(r => parseTextAndImport(r.value))
              .catch(err => {
                console.error(err);
                toast('Word 解析失败，请尝试另存为 .txt 后导入');
              });
          }
        })
        .catch(err => {
          console.error(err);
          toast('Word 解析失败，请尝试另存为 .txt 后导入');
        });
    };
    reader.readAsArrayBuffer(file);
  }
  event.target.value = '';
}

/**
 * 解析 Word 提取的 HTML 表格
 */
function parseWordHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tables = doc.querySelectorAll('table');
  if (tables.length === 0) return null;

  const students = [];
  const NAME_KEYS = ['姓名', '名字', '学生姓名', '学生', 'name', 'Name'];
  const GROUP_KEYS = ['小组', '组别', '组', 'group', 'Group'];

  tables.forEach(table => {
    const trs = table.querySelectorAll('tr');
    if (trs.length < 2) return;

    // 先把所有行转成二维数组方便统一处理
    const rows = [];
    trs.forEach(tr => {
      const cells = tr.querySelectorAll('th, td');
      rows.push(Array.from(cells).map(c => c.textContent.trim()));
    });

    // 用和 Excel 一样的智能列扫描
    const headerRow = rows[0];
    let nameCol = -1, groupCol = -1;
    headerRow.forEach((h, i) => {
      if (NAME_KEYS.includes(h)) nameCol = i;
      if (GROUP_KEYS.includes(h)) groupCol = i;
    });

    // 没识别到表头 → 用 smartPickNameColumn
    // 或者表头识别到了但那一列全是数字 → 也重新扫描
    let needRescan = false;
    if (nameCol === -1) needRescan = true;
    else {
      let colIsAllDigits = true;
      for (let r = 1; r < Math.min(rows.length, 6); r++) {
        const v = String(rows[r]?.[nameCol] || '').trim();
        if (v && !/^\d+$/.test(v)) { colIsAllDigits = false; break; }
      }
      if (colIsAllDigits) needRescan = true;
    }
    if (needRescan) {
      nameCol = smartPickNameColumn(rows, 1);
    }

    // 解析数据行
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;
      const name = String(row[nameCol] || '').trim();
      if (!name) continue;
      if (/^\d+$/.test(name)) continue;
      if (name.length < 2) continue;
      if (['姓名', '名字', '小组', '性别'].includes(name)) continue;

      const group = groupCol >= 0 ? String(row[groupCol] || '').trim() : '';
      students.push({ name, gender: '男', group });
    }
  });

  return students.length > 0 ? students : null;
}

/**
 * 解析纯文本为学生列表
 * 支持格式：
 *   每行一个：姓名,性别,小组  或  姓名 性别 小组  或  姓名
 */
function parseTextAndImport(text) {
  if (!text || !text.trim()) { toast('文档内容为空'); return; }

  // 表头/关键词集合（用于跳过非数据行）
  const SKIP_WORDS = ['姓名', '名字', '性别', '小组', '组别', '组', '学号', '序号', '编号', '班级', '学生', '备注'];
  const TITLE_PATTERN = /(名单|名册|表|班级|学生名单|花名册|目录)/;
  const GENDER_PATTERN = /^(男|女|male|female|M|F|m|f|1|0)$/i;
  const GROUP_PATTERN = /(组|group|队|班)/i;

  // 1. 按行分割，过滤空行
  let lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // 2. 过滤标题行和表头词行
  lines = lines.filter(line => {
    if (TITLE_PATTERN.test(line) && line.length <= 15) return false;
    if (SKIP_WORDS.includes(line)) return false;
    return true;
  });

  if (lines.length === 0) { toast('未识别到有效学生姓名，请检查文档格式'); return; }

  const students = [];

  // 3. 检测是否为"每3行一组"的表格格式（姓名、性别、小组）
  // 判断依据：第2行是性别值，第3行包含"组"或"group"
  const isTableFormat = lines.length >= 3 &&
    GENDER_PATTERN.test(lines[1]) &&
    GROUP_PATTERN.test(lines[2]);

  if (isTableFormat) {
    // 表格格式：每3行一组（姓名、性别、小组）
    for (let i = 0; i + 2 < lines.length; i += 3) {
      const name = lines[i];
      const gender = normalizeGender(lines[i + 1]);
      const group = lines[i + 2] || '';
      if (name && name.length >= 2 && name.length <= 15 && !/[\d]/.test(name)) {
        students.push({ name, gender, group });
      }
    }
  } else {
    // 普通文本格式：每行一个学生，支持逗号/空格/制表符分隔
    for (const line of lines) {
      const parts = line.split(/[,，\s\t]+/).map(p => p.trim()).filter(Boolean);
      if (parts.length === 0) continue;

      const name = parts[0];
      // 验证姓名：2-15字，不含数字和标点
      if (!name || name.length < 2 || name.length > 15) continue;
      if (/[\d\.\(\)（）【】\[\]<>《》]/.test(name)) continue;

      const gender = parts[1] ? normalizeGender(parts[1]) : '男';
      const group = parts[2] || '';
      students.push({ name, gender, group });
    }
  }

  if (students.length === 0) {
    toast('未识别到有效学生姓名，请检查文档格式');
    return;
  }
  showImportPreview(students);
}

// ========== 打印 ==========
function printSchedule() {
  window.print();
}

// ========== 导出图片 ==========
function exportScheduleImage() {
  const container = document.getElementById('scheduleContainer');
  if (!container.innerHTML.trim()) { toast('请先生成值日表'); return; }

  toast('正在生成图片...');
  // 临时给容器加白底
  const prevBg = container.style.background;
  container.style.background = '#fff';
  container.style.padding = '16px';

  html2canvas(container, { backgroundColor: '#ffffff', scale: 2, useCORS: true }).then(canvas => {
    container.style.background = prevBg;
    container.style.padding = '';
    const link = document.createElement('a');
    link.download = `值日表_${currentWeekKey}_${getData().name}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('图片已导出');
  }).catch(err => {
    container.style.background = prevBg;
    container.style.padding = '';
    console.error(err);
    toast('导出失败，请使用打印功能导出PDF');
  });
}
