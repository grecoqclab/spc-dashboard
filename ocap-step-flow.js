// ═══════════════════════════════════════════════════════════════════
// OCAP 步驟式流程系統 - 完整實現
// ═══════════════════════════════════════════════════════════════════

const OCAP_STEP_CONFIG = [
  {
    num: 1,
    title: '由另一位檢驗員再次確認缺陷型態',
    description: '由另一位檢驗員獨立確認缺陷是否真實存在',
    requiresInput: ['cause'],
    parameters: {}
  },
  {
    num: 2,
    title: 'OOC/OOS 通知工程師等列',
    description: '品管工程師確認真實存在',
    requiresInput: ['action'],
    parameters: {}
  },
  {
    num: 3,
    title: '確認顯影機參數設定符合 SOP 規格承接值',
    description: '檢查顯影機參數是否符合規範',
    requiresInput: [],
    wbrParams: ['顯影溫度(℃)', '顯影壓力(Kg/cm²)', '顯影速度 (M/min)']
  },
  {
    num: 4,
    title: '確認曝光靜置時間是否符合規範',
    description: '計算：顯影Move in時間 - 曝光Move out時間',
    requiresInput: [],
    calculateTime: { from: '顯影', fromStatus: 'Move in', to: '曝光', toStatus: 'Move out' }
  },
  {
    num: 5,
    title: '確認導零光參數設定，確認台 Log',
    description: '檢查導零光相關設定',
    requiresInput: [],
    parameters: {}
  },
  {
    num: 6,
    title: '確認覆膜後生產靜置時間',
    description: '計算：曝光Move in時間 - 壓膜Move out時間',
    requiresInput: [],
    calculateTime: { from: '曝光', fromStatus: 'Move in', to: '壓膜', toStatus: 'Move out' }
  },
  {
    num: 7,
    title: '確認覆膜機參數設定，依限膜機 SOP 確認',
    description: '檢查壓膜機參數是否符合規範',
    requiresInput: [],
    wbrParams: ['壓膜上滾輪溫度(℃)', '壓膜下滾輪溫度(℃)', '壓膜壓力(Kg/cm²)', '壓膜速度 (mpm)']
  },
  {
    num: 8,
    title: '確認烘箱參數操作設定',
    description: '檢查銅板烘烤參數是否符合規範',
    requiresInput: [],
    wbrParams: ['銅板烘烤溫度(℃)', '銅板烘烤時間(sec)']
  },
  {
    num: 9,
    title: '重新取樣進行複驗，確認結果是否仍異常',
    description: '重新檢驗並記錄結果',
    requiresInput: ['action'],
    parameters: {}
  },
  {
    num: 10,
    title: '若仍異常，通知 KTC 調查',
    description: '高階通報流程',
    requiresInput: [],
    parameters: {}
  }
];

class OcapStepManager {
  constructor() {
    this.currentViolation = null;
    this.stepStates = {};
    this.stepData = {};
    this.wbrData = null;
    this.currentStepNum = null;
  }

  initialize(violation) {
    this.currentViolation = violation;
    this.stepStates = {};
    this.stepData = {};
    
    OCAP_STEP_CONFIG.forEach(step => {
      this.stepStates[step.num] = step.num === 1 ? 'unlocked' : 'locked';
      this.stepData[step.num] = {
        cause: '',
        action: '',
        owner: '',
        completedAt: null,
        warnings: []
      };
    });
    
    this.currentStepNum = 1;
    this.save();
  }

  save() {
    localStorage.setItem('spc_ocap_flow', JSON.stringify({
      violation: this.currentViolation,
      stepStates: this.stepStates,
      stepData: this.stepData,
      currentStepNum: this.currentStepNum,
      savedAt: new Date().toISOString()
    }));
  }

  completeStep(stepNum) {
    if (this.stepStates[stepNum] !== 'in-progress') return false;
    
    this.stepStates[stepNum] = 'completed';
    this.stepData[stepNum].completedAt = new Date().toLocaleString('zh-TW', 
      { timeZone: 'Asia/Taipei' });
    
    const nextStep = stepNum + 1;
    if (nextStep <= OCAP_STEP_CONFIG.length) {
      this.stepStates[nextStep] = 'unlocked';
    }
    
    this.save();
    return true;
  }

  enterStep(stepNum) {
    const status = this.stepStates[stepNum];
    if (status === 'locked') return false;
    
    if (status !== 'in-progress' && status !== 'completed') {
      this.stepStates[stepNum] = 'in-progress';
    }
    this.currentStepNum = stepNum;
    this.save();
    return true;
  }

  isAllComplete() {
    return OCAP_STEP_CONFIG.every(step => 
      this.stepStates[step.num] === 'completed'
    );
  }

  reset() {
    localStorage.removeItem('spc_ocap_flow');
    this.currentViolation = null;
    this.stepStates = {};
    this.stepData = {};
    this.currentStepNum = null;
  }
}

const ocapManager = new OcapStepManager();

async function openOcapStepFlow(violation) {
  ocapManager.initialize(violation);
  document.getElementById('ocapStepBatch').textContent = violation.batch || '—';
  document.getElementById('ocapStepRule').textContent = violation.rule || '—';
  renderOcapStepTimeline();
  goToOcapStep(1);
  document.getElementById('ocapStepOverlay').classList.add('show');
}

function closeOcapStepFlow() {
  if (confirm('確定要關閉？未完成的流程將儲存為草稿。')) {
    document.getElementById('ocapStepOverlay').classList.remove('show');
  }
}

function renderOcapStepTimeline() {
  const list = document.getElementById('ocapStepList');
  list.innerHTML = '';
  
  OCAP_STEP_CONFIG.forEach(step => {
    const status = ocapManager.stepStates[step.num];
    const item = document.createElement('div');
    item.className = `ocap-step-item ${status}`;
    
    let icon = '';
    if (status === 'locked') icon = '🔒';
    else if (status === 'in-progress') icon = '⏳';
    else if (status === 'completed') icon = '✅';
    else icon = '⏹️';
    
    item.innerHTML = `<span>${icon}</span> Step ${step.num}: ${step.title}`;
    item.onclick = () => goToOcapStep(step.num);
    
    if (status === 'locked') {
      item.style.cursor = 'not-allowed';
    }
    
    list.appendChild(item);
  });
  
  updateOcapProgress();
}

function goToOcapStep(stepNum) {
  const status = ocapManager.stepStates[stepNum];
  
  if (status === 'locked') {
    alert('此步驟尚未解鎖，請先完成前面的步驟。');
    return;
  }

  if (status !== 'in-progress' && status !== 'completed') {
    ocapManager.enterStep(stepNum);
  }

  renderOcapStepContent(stepNum);
  renderOcapStepTimeline();
  updateNavigation();
}

function renderOcapStepContent(stepNum) {
  const config = OCAP_STEP_CONFIG.find(s => s.num === stepNum);
  const data = ocapManager.stepData[stepNum];
  const body = document.getElementById('ocapStepBody');
  
  let html = `
    <h4>Step ${config.num}: ${config.title}</h4>
    <p>${config.description}</p>
  `;
  
  if (config.wbrParams && config.wbrParams.length > 0) {
    html += '<h5>【設定參數】</h5><div class="ocap-step-params">';
    config.wbrParams.forEach(paramName => {
      html += `
        <div class="ocap-step-param-item">
          <div class="ocap-step-param-name">${paramName}</div>
          <div class="ocap-step-param-value ok">(請從 WBR Sheet 確認)</div>
        </div>
      `;
    });
    html += '</div>';
  }
  
  if (config.calculateTime) {
    html += '<h5>【靜置時間計算】</h5><div class="ocap-step-params">';
    html += `<div class="ocap-step-param-item">
      <div class="ocap-step-param-name">計算方式</div>
      <div class="ocap-step-param-value">${config.calculateTime.from}${config.calculateTime.fromStatus} - ${config.calculateTime.to}${config.calculateTime.toStatus}</div>
    </div>`;
    html += '</div>';
  }
  
  if (config.requiresInput.length > 0) {
    html += '<h5>【需填寫】</h5>';
    
    config.requiresInput.forEach(field => {
      if (field === 'cause') {
        html += `
          <div class="ocap-step-form-group">
            <label class="ocap-step-form-label">原因分析 <span style="color:#DC2626">*</span></label>
            <textarea id="ocapStepCause" class="ocap-step-form-input" 
                      style="height:100px;resize:vertical"
                      placeholder="描述異常原因…">${data.cause || ''}</textarea>
          </div>
        `;
      } else if (field === 'action') {
        html += `
          <div class="ocap-step-form-group">
            <label class="ocap-step-form-label">矯正措施 <span style="color:#DC2626">*</span></label>
            <textarea id="ocapStepAction" class="ocap-step-form-input" 
                      style="height:100px;resize:vertical"
                      placeholder="已採取的矯正行動…">${data.action || ''}</textarea>
          </div>
        `;
      }
    });
  }
  
  if (ocapManager.stepStates[stepNum] === 'in-progress') {
    html += `
      <button class="ocap-step-complete-btn" onclick="completeOcapStep(${stepNum})">
        ✓ 完成 Step ${stepNum}
      </button>
    `;
  }
  
  body.innerHTML = html;
}

function completeOcapStep(stepNum) {
  const config = OCAP_STEP_CONFIG.find(s => s.num === stepNum);
  
  if (config.requiresInput.includes('cause')) {
    const cause = document.getElementById('ocapStepCause')?.value.trim();
    if (!cause) {
      alert('請填寫原因分析');
      return;
    }
    ocapManager.stepData[stepNum].cause = cause;
  }
  
  if (config.requiresInput.includes('action')) {
    const action = document.getElementById('ocapStepAction')?.value.trim();
    if (!action) {
      alert('請填寫矯正措施');
      return;
    }
    ocapManager.stepData[stepNum].action = action;
  }
  
  if (ocapManager.completeStep(stepNum)) {
    if (stepNum < OCAP_STEP_CONFIG.length) {
      goToOcapStep(stepNum + 1);
    } else {
      document.getElementById('ocapStepSubmit').style.display = 'inline-block';
      renderOcapStepTimeline();
    }
  }
}

function updateNavigation() {
  const current = ocapManager.currentStepNum;
  const prevBtn = document.getElementById('ocapStepPrev');
  const nextBtn = document.getElementById('ocapStepNext');
  
  prevBtn.disabled = current <= 1;
  nextBtn.disabled = current >= OCAP_STEP_CONFIG.length || 
                    ocapManager.stepStates[current] !== 'completed';
}

function previousOcapStep() {
  if (ocapManager.currentStepNum > 1) {
    goToOcapStep(ocapManager.currentStepNum - 1);
  }
}

function nextOcapStep() {
  if (ocapManager.currentStepNum < OCAP_STEP_CONFIG.length) {
    goToOcapStep(ocapManager.currentStepNum + 1);
  }
}

async function submitOcapStepFlow() {
  if (!ocapManager.isAllComplete()) {
    alert('請完成所有 10 個步驟');
    return;
  }

  const payload = {
    action: 'saveOcap',
    batch: ocapManager.currentViolation.batch,
    rule: ocapManager.currentViolation.rule,
    product: ocapManager.currentViolation.product,
    detectedAt: ocapManager.currentViolation.detectedAt,
    cause: ocapManager.stepData[1].cause,
    action: ocapManager.stepData[2].action || ocapManager.stepData[9].action,
    owner: '品保工程師',
    dueDate: '',
    allStepsCompleted: true,
    completedAt: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
  };

  const scriptUrl = loadOcapSettings().scriptUrl;
  if (scriptUrl) {
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload)
      });
    } catch(err) {
      console.error('提交失敗：', err);
    }
  }

  markViolationAsResolved(ocapManager.currentViolation.batch, 
                          ocapManager.currentViolation.rule);

  ocapManager.reset();
  update();
  dismissOcapBanner();
  closeOcapStepFlow();
  
  alert('✅ OCAP 流程已完成，異常已標記為已解決');
}

function updateOcapProgress() {
  const completed = Object.values(ocapManager.stepStates)
    .filter(s => s === 'completed').length;
  const total = OCAP_STEP_CONFIG.length;
  
  const percent = total > 0 ? (completed / total) * 100 : 0;
  document.getElementById('ocapStepProgressFill').style.width = percent + '%';
  document.getElementById('ocapStepProgressLabel').textContent = `${completed}/${total}`;
}
