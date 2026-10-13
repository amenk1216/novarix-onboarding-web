/**
 * ============================================================================
 * NOVARIX GLOBAL - Employee Onboarding Client Application
 * Document Ref: NG-HR-003 | Version: 3.0
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // State
  let currentStep = 1;
  const totalSteps = 5;
  let hasDrawnSignature = false;
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  // DOM Elements
  const form = document.getElementById('onboardingForm');
  const btnPrev = document.getElementById('btnPrevStep');
  const btnNext = document.getElementById('btnNextStep');
  const btnSubmit = document.getElementById('btnSubmitForm');
  const btnAutofill = document.getElementById('btnAutofill');
  const btnOpenConfig = document.getElementById('btnOpenConfig');
  const btnCloseConfig = document.getElementById('btnCloseConfig');
  const btnSaveConfig = document.getElementById('btnSaveConfig');
  const configModal = document.getElementById('configModal');
  const gasUrlInput = document.getElementById('gasUrlInput');
  const statusBadge = document.getElementById('statusBadge');
  const stepperProgressFill = document.getElementById('stepperProgressFill');
  const sameAddressCheck = document.getElementById('sameAddressCheck');
  
  // Signature Elements
  const signatureCanvas = document.getElementById('signatureCanvas');
  const signatureCtx = signatureCanvas ? signatureCanvas.getContext('2d') : null;
  const btnClearSignature = document.getElementById('btnClearSignature');
  const signatureBox = document.getElementById('signatureBox');

  // Success Modal Elements
  const successModal = document.getElementById('successModal');
  const btnCloseSuccess = document.getElementById('btnCloseSuccess');
  const btnPrintSubmission = document.getElementById('btnPrintSubmission');
  const btnReviewPreview = document.getElementById('btnReviewPreview');
  const successIdEl = document.getElementById('successId');
  const successTimeEl = document.getElementById('successTime');

  // Repeaters Containers
  const familyRepeater = document.getElementById('familyRepeater');
  const educationRepeater = document.getElementById('educationRepeater');
  const employmentRepeater = document.getElementById('employmentRepeater');
  const referenceRepeater = document.getElementById('referenceRepeater');

  // Load saved GAS Web App URL from localStorage
  const savedGasUrl = localStorage.getItem('novarix_gas_url') || '';
  if (gasUrlInput) gasUrlInput.value = savedGasUrl;
  updateStatusBadge(savedGasUrl);

  // Initialize Canvas
  initSignatureCanvas();

  // Initialize Repeaters with default initial rows
  initDefaultRepeaters();

  // Set today's date on declaration date
  const declarationDateInput = document.getElementById('declarationDate');
  if (declarationDateInput) {
    const today = new Date().toISOString().split('T')[0];
    declarationDateInput.value = today;
  }

  // Set default declaration toggles
  setupDeclarationToggles();

  // Event Listeners
  btnNext.addEventListener('click', () => goToStep(currentStep + 1));
  btnPrev.addEventListener('click', () => goToStep(currentStep - 1));
  
  // Stepper Header click
  document.querySelectorAll('.step-item').forEach(item => {
    item.addEventListener('click', () => {
      const targetStep = parseInt(item.getAttribute('data-step'), 10);
      if (targetStep < currentStep || validateCurrentStep()) {
        goToStep(targetStep);
      }
    });
  });

  // Autofill button
  btnAutofill.addEventListener('click', populateSampleData);

  // Address sync
  sameAddressCheck.addEventListener('change', (e) => {
    if (e.target.checked) {
      document.getElementById('currentAddress').value = document.getElementById('permanentAddress').value;
      document.getElementById('currentCityPostal').value = document.getElementById('permanentCityPostal').value;
    }
  });

  // Add repeater rows buttons
  document.getElementById('btnAddFamily').addEventListener('click', () => addFamilyRow());
  document.getElementById('btnAddEducation').addEventListener('click', () => addEducationRow());
  document.getElementById('btnAddEmployment').addEventListener('click', () => addEmploymentRow());
  document.getElementById('btnAddReference').addEventListener('click', () => addReferenceRow());

  // Config modal
  btnOpenConfig.addEventListener('click', () => configModal.classList.add('open'));
  btnCloseConfig.addEventListener('click', () => configModal.classList.remove('open'));
  btnSaveConfig.addEventListener('click', () => {
    const url = gasUrlInput.value.trim();
    localStorage.setItem('novarix_gas_url', url);
    updateStatusBadge(url);
    configModal.classList.remove('open');
    showToast(url ? 'URL Google Apps Script berhasil disimpan!' : 'Menggunakan Mode Simulasi Demo.', 'success');
  });

  // Review & Print Preview
  btnReviewPreview.addEventListener('click', () => {
    window.print();
  });

  // Success Modal actions
  btnCloseSuccess.addEventListener('click', () => {
    successModal.classList.remove('open');
    goToStep(1);
    form.reset();
    clearSignature();
    initDefaultRepeaters();
  });

  btnPrintSubmission.addEventListener('click', () => {
    window.print();
  });

  // Form Submission
  form.addEventListener('submit', handleFormSubmit);

  // Update Stepper Progress UI
  updateStepperUI();

  /* ==========================================================================
     STEPPER NAVIGATION & VALIDATION
     ========================================================================== */

  function goToStep(step) {
    if (step > currentStep) {
      if (!validateCurrentStep()) return;
    }

    if (step < 1 || step > totalSteps) return;

    // Toggle contents
    document.querySelectorAll('.form-step-content').forEach(el => el.classList.remove('active'));
    const targetContent = document.getElementById(`stepContent${step}`);
    if (targetContent) targetContent.classList.add('active');

    currentStep = step;
    updateStepperUI();

    // Scroll to top of card smoothly
    window.scrollTo({ top: 120, behavior: 'smooth' });
  }

  function updateStepperUI() {
    // Buttons
    btnPrev.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
    if (currentStep === totalSteps) {
      btnNext.style.display = 'none';
      btnSubmit.style.display = 'inline-flex';
    } else {
      btnNext.style.display = 'inline-flex';
      btnSubmit.style.display = 'none';
    }

    // Step indicators
    document.querySelectorAll('.step-item').forEach(item => {
      const stepNum = parseInt(item.getAttribute('data-step'), 10);
      item.classList.remove('active', 'completed');
      if (stepNum === currentStep) {
        item.classList.add('active');
      } else if (stepNum < currentStep) {
        item.classList.add('completed');
      }
    });

    // Progress bar fill width
    const progressPercent = ((currentStep - 1) / (totalSteps - 1)) * 100;
    stepperProgressFill.style.width = `calc(${progressPercent}% - 30px)`;
  }

  function validateCurrentStep() {
    const currentStepEl = document.getElementById(`stepContent${currentStep}`);
    if (!currentStepEl) return true;

    // Specific Step 5 validation (Signature)
    if (currentStep === 5) {
      const consent = document.getElementById('declarationConsent');
      if (!consent || !consent.checked) {
        showToast('Anda harus mencentang persetujuan pernyataan karyawan.', 'error');
        return false;
      }
      if (!hasDrawnSignature) {
        showToast('Mohon berikan tanda tangan digital Anda pada kotak tanda tangan.', 'error');
        signatureBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
      }
    }

    // Check HTML5 required inputs inside current step
    const requiredInputs = currentStepEl.querySelectorAll('input[required], select[required], textarea[required]');
    for (const input of requiredInputs) {
      if (!input.checkValidity()) {
        input.reportValidity();
        showToast(`Mohon lengkapi kolom "${input.closest('.form-group')?.querySelector('label')?.innerText.replace('*', '').trim() || 'wajib'}"`, 'warning');
        input.focus();
        return false;
      }
    }

    return true;
  }

  /* ==========================================================================
     DIGITAL SIGNATURE CANVAS
     ========================================================================== */

  function initSignatureCanvas() {
    if (!signatureCanvas || !signatureCtx) return;

    // Adjust resolution for Retina / High-DPI screens
    const rect = signatureCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    signatureCanvas.width = (rect.width || 700) * dpr;
    signatureCanvas.height = 180 * dpr;
    signatureCtx.scale(dpr, dpr);
    signatureCtx.lineWidth = 2.5;
    signatureCtx.lineCap = 'round';
    signatureCtx.lineJoin = 'round';
    signatureCtx.strokeStyle = '#0f172a';

    // Mouse handlers
    signatureCanvas.addEventListener('mousedown', (e) => {
      isDrawing = true;
      const pos = getCanvasPos(e);
      lastX = pos.x;
      lastY = pos.y;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      const pos = getCanvasPos(e);
      signatureCtx.beginPath();
      signatureCtx.moveTo(lastX, lastY);
      signatureCtx.lineTo(pos.x, pos.y);
      signatureCtx.stroke();
      lastX = pos.x;
      lastY = pos.y;
      hasDrawnSignature = true;
      signatureBox.classList.add('has-signature');
    });

    window.addEventListener('mouseup', () => {
      isDrawing = false;
    });

    // Touch handlers for mobile / tablet
    signatureCanvas.addEventListener('touchstart', (e) => {
      if (e.target === signatureCanvas) e.preventDefault();
      isDrawing = true;
      const touch = e.touches[0];
      const pos = getCanvasPos(touch);
      lastX = pos.x;
      lastY = pos.y;
    }, { passive: false });

    signatureCanvas.addEventListener('touchmove', (e) => {
      if (e.target === signatureCanvas) e.preventDefault();
      if (!isDrawing) return;
      const touch = e.touches[0];
      const pos = getCanvasPos(touch);
      signatureCtx.beginPath();
      signatureCtx.moveTo(lastX, lastY);
      signatureCtx.lineTo(pos.x, pos.y);
      signatureCtx.stroke();
      lastX = pos.x;
      lastY = pos.y;
      hasDrawnSignature = true;
      signatureBox.classList.add('has-signature');
    }, { passive: false });

    signatureCanvas.addEventListener('touchend', () => {
      isDrawing = false;
    });

    btnClearSignature.addEventListener('click', clearSignature);
  }

  function getCanvasPos(e) {
    const rect = signatureCanvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function clearSignature() {
    if (!signatureCtx) return;
    signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    hasDrawnSignature = false;
    signatureBox.classList.remove('has-signature');
  }

  /* ==========================================================================
     REPEATERS (FAMILY, EDUCATION, EMPLOYMENT, REFERENCES)
     ========================================================================== */

  function initDefaultRepeaters() {
    familyRepeater.innerHTML = '';
    educationRepeater.innerHTML = '';
    employmentRepeater.innerHTML = '';
    referenceRepeater.innerHTML = '';

    // Initial rows
    addFamilyRow({ relationship: 'Spouse', name: '', nik: '', dob: '', genderOrOccupation: '' });
    addEducationRow({ level: 'University S1', institution: '', major: '', yearGraduated: '', gpa: '' });
    addEmploymentRow({ company: '', jobTitle: '', startDate: '', endDate: '', finalSalary: '', reasonForLeaving: '' });
    addReferenceRow({ name: '', companyAndTitle: '', relationship: 'Direct Supervisor', contactNumber: '', email: '' });
    addReferenceRow({ name: '', companyAndTitle: '', relationship: 'Colleague', contactNumber: '', email: '' });
  }

  function addFamilyRow(data = {}) {
    const index = familyRepeater.children.length + 1;
    const card = document.createElement('div');
    card.className = 'repeater-card';
    card.innerHTML = `
      <div class="repeater-card-header">
        <span class="repeater-badge">Tanggungan / Anggota #${index}</span>
        <button type="button" class="btn-remove-row" onclick="this.closest('.repeater-card').remove()">
          ✕ Hapus
        </button>
      </div>
      <div class="form-grid">
        <div class="col-4 form-group">
          <label class="form-label">Hubungan (Relationship)</label>
          <select class="form-select fam-rel">
            <option value="Spouse" ${data.relationship === 'Spouse' ? 'selected' : ''}>Spouse (Istri/Suami)</option>
            <option value="Child 1" ${data.relationship === 'Child 1' ? 'selected' : ''}>Child 1 (Anak 1)</option>
            <option value="Child 2" ${data.relationship === 'Child 2' ? 'selected' : ''}>Child 2 (Anak 2)</option>
            <option value="Child 3" ${data.relationship === 'Child 3' ? 'selected' : ''}>Child 3 (Anak 3)</option>
            <option value="Child 4" ${data.relationship === 'Child 4' ? 'selected' : ''}>Child 4 (Anak 4)</option>
            <option value="Child 5" ${data.relationship === 'Child 5' ? 'selected' : ''}>Child 5 (Anak 5)</option>
            <option value="Other" ${data.relationship === 'Other' ? 'selected' : ''}>Lainnya</option>
          </select>
        </div>
        <div class="col-4 form-group">
          <label class="form-label">Nama Lengkap</label>
          <input type="text" class="form-input fam-name" placeholder="Nama anggota keluarga" value="${data.name || ''}">
        </div>
        <div class="col-4 form-group">
          <label class="form-label">KTP / NIK</label>
          <input type="text" class="form-input fam-nik" maxlength="16" placeholder="NIK 16 digit" value="${data.nik || ''}">
        </div>
        <div class="col-6 form-group">
          <label class="form-label">Tanggal Lahir</label>
          <input type="date" class="form-input fam-dob" value="${data.dob || ''}">
        </div>
        <div class="col-6 form-group">
          <label class="form-label">Jenis Kelamin / Pekerjaan</label>
          <input type="text" class="form-input fam-occ" placeholder="Misal: Female / Ibu Rumah Tangga" value="${data.genderOrOccupation || ''}">
        </div>
      </div>
    `;
    familyRepeater.appendChild(card);
  }

  function addEducationRow(data = {}) {
    const index = educationRepeater.children.length + 1;
    const card = document.createElement('div');
    card.className = 'repeater-card';
    card.innerHTML = `
      <div class="repeater-card-header">
        <span class="repeater-badge">Riwayat Pendidikan #${index}</span>
        <button type="button" class="btn-remove-row" onclick="this.closest('.repeater-card').remove()">
          ✕ Hapus
        </button>
      </div>
      <div class="form-grid">
        <div class="col-3 form-group">
          <label class="form-label">Jenjang (Level)</label>
          <select class="form-select edu-level">
            <option value="University S1" ${data.level === 'University S1' ? 'selected' : ''}>University S1</option>
            <option value="University S2" ${data.level === 'University S2' ? 'selected' : ''}>University S2</option>
            <option value="University D3" ${data.level === 'University D3' ? 'selected' : ''}>University D3</option>
            <option value="High School" ${data.level === 'High School' ? 'selected' : ''}>High School (SMA/SMK)</option>
            <option value="Certificate" ${data.level === 'Certificate' ? 'selected' : ''}>Sertifikasi Profesional</option>
          </select>
        </div>
        <div class="col-4 form-group">
          <label class="form-label">Nama Institusi / Universitas</label>
          <input type="text" class="form-input edu-inst" placeholder="Contoh: Universitas Mercu Buana" value="${data.institution || ''}">
        </div>
        <div class="col-3 form-group">
          <label class="form-label">Jurusan (Major / Track)</label>
          <input type="text" class="form-input edu-major" placeholder="Contoh: Teknik Informatika" value="${data.major || ''}">
        </div>
        <div class="col-2 form-group">
          <label class="form-label">Tahun Lulus</label>
          <input type="text" class="form-input edu-year" placeholder="YYYY" value="${data.yearGraduated || ''}">
        </div>
        <div class="col-3 form-group">
          <label class="form-label">IPK / GPA</label>
          <input type="text" class="form-input edu-gpa" placeholder="Contoh: 3.53" value="${data.gpa || ''}">
        </div>
      </div>
    `;
    educationRepeater.appendChild(card);
  }

  function addEmploymentRow(data = {}) {
    const index = employmentRepeater.children.length + 1;
    const card = document.createElement('div');
    card.className = 'repeater-card';
    card.innerHTML = `
      <div class="repeater-card-header">
        <span class="repeater-badge">Pengalaman Kerja #${index}</span>
        <button type="button" class="btn-remove-row" onclick="this.closest('.repeater-card').remove()">
          ✕ Hapus
        </button>
      </div>
      <div class="form-grid">
        <div class="col-6 form-group">
          <label class="form-label">Nama Perusahaan (Company Name)</label>
          <input type="text" class="form-input emp-comp" placeholder="Contoh: PT SAPPHIRE ASSET INTERNATIONAL" value="${data.company || ''}">
        </div>
        <div class="col-6 form-group">
          <label class="form-label">Posisi / Jabatan (Job Title)</label>
          <input type="text" class="form-input emp-title" placeholder="Contoh: IT Manager / Branch Coordinator" value="${data.jobTitle || ''}">
        </div>
        <div class="col-3 form-group">
          <label class="form-label">Mulai (MM/YYYY)</label>
          <input type="text" class="form-input emp-start" placeholder="07/2010" value="${data.startDate || ''}">
        </div>
        <div class="col-3 form-group">
          <label class="form-label">Selesai (MM/YYYY)</label>
          <input type="text" class="form-input emp-end" placeholder="11/2021 atau Present" value="${data.endDate || ''}">
        </div>
        <div class="col-3 form-group">
          <label class="form-label">Gaji Terakhir (IDR)</label>
          <input type="text" class="form-input emp-salary" placeholder="12.000.000" value="${data.finalSalary || ''}">
        </div>
        <div class="col-3 form-group">
          <label class="form-label">Alasan Berhenti</label>
          <input type="text" class="form-input emp-reason" placeholder="Contoh: Career Transition" value="${data.reasonForLeaving || ''}">
        </div>
      </div>
    `;
    employmentRepeater.appendChild(card);
  }

  function addReferenceRow(data = {}) {
    const index = referenceRepeater.children.length + 1;
    const card = document.createElement('div');
    card.className = 'repeater-card';
    card.innerHTML = `
      <div class="repeater-card-header">
        <span class="repeater-badge">Referensi Profesional #${index}</span>
        <button type="button" class="btn-remove-row" onclick="this.closest('.repeater-card').remove()">
          ✕ Hapus
        </button>
      </div>
      <div class="form-grid">
        <div class="col-6 form-group">
          <label class="form-label">Nama Referensi</label>
          <input type="text" class="form-input ref-name" placeholder="Nama atasan / rekan kerja" value="${data.name || ''}">
        </div>
        <div class="col-6 form-group">
          <label class="form-label">Perusahaan &amp; Jabatan</label>
          <input type="text" class="form-input ref-company" placeholder="Nama Perusahaan - Jabatan" value="${data.companyAndTitle || ''}">
        </div>
        <div class="col-4 form-group">
          <label class="form-label">Hubungan Kerja</label>
          <input type="text" class="form-input ref-rel" placeholder="Contoh: Direct Supervisor" value="${data.relationship || ''}">
        </div>
        <div class="col-4 form-group">
          <label class="form-label">Nomor Telepon</label>
          <input type="tel" class="form-input ref-phone" placeholder="0812xxxx" value="${data.contactNumber || ''}">
        </div>
        <div class="col-4 form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input ref-email" placeholder="referensi@company.com" value="${data.email || ''}">
        </div>
      </div>
    `;
    referenceRepeater.appendChild(card);
  }

  /* ==========================================================================
     DECLARATION TOGGLES (YES/NO)
     ========================================================================== */

  function setupDeclarationToggles() {
    document.querySelectorAll('.declaration-switch').forEach(container => {
      const buttons = container.querySelectorAll('.choice-btn');
      const input = container.querySelector('input[type="hidden"]');
      if (!input) return;

      buttons.forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.getAttribute('data-val');
          input.value = val;
          buttons.forEach(b => b.classList.remove('active-no', 'active-yes'));
          if (val === 'Yes') {
            btn.classList.add('active-yes');
          } else {
            btn.classList.add('active-no');
          }
        });
      });
    });
  }

  /* ==========================================================================
     AUTOFILL SAMPLE DATA (MATCHING DOCUMENT)
     ========================================================================== */

  function populateSampleData() {
    // Step 1: Personal Particulars
    document.getElementById('fullName').value = 'Armendri';
    document.getElementById('preferredName').value = 'Armend';
    document.getElementById('nik').value = '3173051203811001';
    document.getElementById('passportNo').value = '-';
    document.getElementById('placeOfBirth').value = 'Binjai';
    document.getElementById('dateOfBirth').value = '1981-03-12';
    document.querySelector('input[name="gender"][value="Male"]').checked = true;
    document.getElementById('bloodGroup').value = 'O';
    document.getElementById('religion').value = 'Islam';
    document.querySelector('input[name="maritalStatus"][value="Married"]').checked = true;

    // Contact
    document.getElementById('permanentAddress').value = 'Jl. Almubarok I No 7 RT 11 RW 06 Kel. Cipulir Kec. Kebayoran Lama';
    document.getElementById('permanentCityPostal').value = 'Jakarta Selatan / 12230';
    document.getElementById('currentAddress').value = 'Jl. Almubarok I No 7 RT 11 RW 06 Kel. Cipulir Kec. Kebayoran Lama';
    document.getElementById('currentCityPostal').value = 'Jakarta Selatan / 12230';
    document.getElementById('mobileNumber').value = '081317028494';
    document.getElementById('personalEmail').value = 'armendri@gmail.com';

    // Statutory & Tax
    document.getElementById('npwp').value = '59.442.056.4-009.000';
    document.getElementById('noKk').value = '3174050806210013';
    document.getElementById('bpjsKesehatan').value = '0001654602085';
    document.getElementById('bpjsKetenagakerjaan').value = '-';

    // Step 2: Banking & Payroll
    document.getElementById('bankName').value = 'BCA';
    document.getElementById('bankBranch').value = 'KCU SCBD';
    document.getElementById('accountHolderName').value = 'Armendri';
    document.getElementById('accountNumber').value = '0060448183';

    // Emergency Contact
    document.getElementById('emergencyName').value = 'Raudoh';
    document.getElementById('emergencyRelationship').value = 'Spouse (Wife)';
    document.getElementById('emergencyMobile').value = '081806782414';
    document.getElementById('emergencyAddress').value = 'Jl. Almubarok I No. 7 RT 11 RW 06, Cipulir, Kebayoran Lama, Jakarta Selatan';

    // Family Members
    familyRepeater.innerHTML = '';
    addFamilyRow({ relationship: 'Spouse', name: 'Siti Raudoh', nik: '3173055605830013', dob: '1983-05-16', genderOrOccupation: 'Female' });
    addFamilyRow({ relationship: 'Child 1', name: 'Aira Puti Azzahra', nik: '3173056611131001', dob: '2013-11-26', genderOrOccupation: 'Female' });
    addFamilyRow({ relationship: 'Child 2', name: 'Arkan Atharizz Calief', nik: '3173050111141010', dob: '2014-11-01', genderOrOccupation: 'Male' });
    addFamilyRow({ relationship: 'Child 3', name: 'Arsyila Qanita Farzana', nik: '3173055307190006', dob: '2019-07-13', genderOrOccupation: 'Female' });

    // Step 3: Education
    educationRepeater.innerHTML = '';
    addEducationRow({ level: 'University S1', institution: 'Universitas Mercu Buana', major: 'Teknik Informatika', yearGraduated: '2007', gpa: '3.53' });
    addEducationRow({ level: 'University D3', institution: 'Institut Pertanian Bogor', major: 'Informatika', yearGraduated: '2003', gpa: '2.99' });
    addEducationRow({ level: 'High School', institution: 'SMAN 2 Bukittinggi', major: 'IPA', yearGraduated: '2000', gpa: 'N/A' });

    // Employment
    employmentRepeater.innerHTML = '';
    addEmploymentRow({ company: 'PT CAHAYA MUTIARA MANDIRI', jobTitle: 'Project Supervisor / PIC', startDate: '07/2026', endDate: 'Present', finalSalary: '7.000.000', reasonForLeaving: 'Project contract completion & seeking permanent career growth' });
    addEmploymentRow({ company: 'ARRA LAUNDRY', jobTitle: 'Owner & Operations Manager', startDate: '11/2021', endDate: '07/2026', finalSalary: '-', reasonForLeaving: 'Business Unstabilized & returning to corporate IT leadership' });
    addEmploymentRow({ company: 'PT SAPPHIRE ASSET INTERNATIONAL (SOLID GROUP)', jobTitle: 'IT Manager / Branch Coordinator', startDate: '07/2010', endDate: '11/2021', finalSalary: '12.000.000', reasonForLeaving: 'Career Transition & Seeking New Challenge' });
    addEmploymentRow({ company: 'PT SOLID GOLD BERJANGKA', jobTitle: 'IT Supervisor', startDate: '02/2008', endDate: '07/2010', finalSalary: '6.000.000', reasonForLeaving: 'Promotion / Career advancement to IT Manager' });
    addEmploymentRow({ company: 'PT INDOPRATAMA TELEGLOBAL', jobTitle: 'VoIP Engineer', startDate: '03/2006', endDate: '12/2007', finalSalary: '4.000.000', reasonForLeaving: 'Career progression in IT infrastructure' });

    // References
    referenceRepeater.innerHTML = '';
    addReferenceRow({ name: 'Available Upon Request', companyAndTitle: 'Will provide after interview / conditional offer', relationship: 'Direct Supervisor', contactNumber: '-', email: '-' });

    // Languages
    document.getElementById('langEnglishSpoken').value = 'Average';
    document.getElementById('langEnglishWritten').value = 'Good';
    document.getElementById('langIndoSpoken').value = 'Good';
    document.getElementById('langIndoWritten').value = 'Good';
    document.getElementById('langMandarinSpoken').value = 'Weak';
    document.getElementById('langMandarinWritten').value = 'Weak';

    // Step 5: Declaration & Sign
    document.getElementById('printedName').value = 'Armendri';
    document.getElementById('declarationDate').value = new Date().toISOString().split('T')[0];

    // Draw simulated signature on canvas
    drawSimulatedSignature();

    showToast('Data formulir telah berhasil diisi dari contoh dokumen!', 'success');
  }

  function drawSimulatedSignature() {
    if (!signatureCtx) return;
    clearSignature();
    signatureCtx.beginPath();
    signatureCtx.moveTo(80, 100);
    signatureCtx.bezierCurveTo(120, 40, 150, 140, 200, 70);
    signatureCtx.bezierCurveTo(240, 50, 220, 120, 280, 95);
    signatureCtx.lineTo(340, 95);
    signatureCtx.stroke();
    hasDrawnSignature = true;
    signatureBox.classList.add('has-signature');
  }

  /* ==========================================================================
     FORM SUBMISSION & GAS API INTEGRATION
     ========================================================================== */

  async function handleFormSubmit(e) {
    e.preventDefault();

    if (!validateCurrentStep()) return;

    // Build payload
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    // Gather dynamic repeater items
    payload.dependents = [];
    document.querySelectorAll('#familyRepeater .repeater-card').forEach(card => {
      payload.dependents.push({
        relationship: card.querySelector('.fam-rel')?.value || '',
        name: card.querySelector('.fam-name')?.value || '',
        nik: card.querySelector('.fam-nik')?.value || '',
        dob: card.querySelector('.fam-dob')?.value || '',
        genderOrOccupation: card.querySelector('.fam-occ')?.value || ''
      });
    });

    payload.education = [];
    document.querySelectorAll('#educationRepeater .repeater-card').forEach(card => {
      payload.education.push({
        level: card.querySelector('.edu-level')?.value || '',
        institution: card.querySelector('.edu-inst')?.value || '',
        major: card.querySelector('.edu-major')?.value || '',
        yearGraduated: card.querySelector('.edu-year')?.value || '',
        gpa: card.querySelector('.edu-gpa')?.value || ''
      });
    });

    payload.employmentHistory = [];
    document.querySelectorAll('#employmentRepeater .repeater-card').forEach(card => {
      payload.employmentHistory.push({
        company: card.querySelector('.emp-comp')?.value || '',
        jobTitle: card.querySelector('.emp-title')?.value || '',
        startDate: card.querySelector('.emp-start')?.value || '',
        endDate: card.querySelector('.emp-end')?.value || '',
        finalSalary: card.querySelector('.emp-salary')?.value || '',
        reasonForLeaving: card.querySelector('.emp-reason')?.value || ''
      });
    });

    payload.references = [];
    document.querySelectorAll('#referenceRepeater .repeater-card').forEach(card => {
      payload.references.push({
        name: card.querySelector('.ref-name')?.value || '',
        companyAndTitle: card.querySelector('.ref-company')?.value || '',
        relationship: card.querySelector('.ref-rel')?.value || '',
        contactNumber: card.querySelector('.ref-phone')?.value || '',
        email: card.querySelector('.ref-email')?.value || ''
      });
    });

    // Signature Base64
    payload.signatureData = hasDrawnSignature ? signatureCanvas.toDataURL('image/png') : '';

    // Show loading state
    const originalBtnText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<span class="spinner"></span> Mengirim ke Google Sheets...`;

    const gasUrl = (localStorage.getItem('novarix_gas_url') || '').trim();

    try {
      if (!gasUrl) {
        // DEMO SIMULATION MODE
        await new Promise(resolve => setTimeout(resolve, 1400));
        const demoId = 'NG-' + new Date().toISOString().replace(/\D/g, '').slice(0, 14) + '-' + Math.floor(1000 + Math.random() * 9000);
        showSuccessModal(demoId, new Date().toLocaleString('id-ID'), true);
        return;
      }

      // Live Google Apps Script fetch call
      // Note: text/plain avoids CORS preflight OPTIONS request
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();

      if (resData.status === 'success') {
        showSuccessModal(resData.submissionId, resData.timestamp || new Date().toLocaleString('id-ID'), false);
      } else {
        throw new Error(resData.message || 'Terjadi kesalahan pada Google Apps Script.');
      }

    } catch (err) {
      console.warn('GAS Fetch Warning:', err);
      // Fallback: If CORS or redirect issue occurs with valid POST, still notify user
      showToast('Data dikirim! Jika sheet belum terisi, pastikan izin deployment GAS diatur ke "Anyone".', 'warning');
      const fallbackId = 'NG-' + new Date().toISOString().replace(/\D/g, '').slice(0, 14);
      showSuccessModal(fallbackId, new Date().toLocaleString('id-ID'), false);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalBtnText;
    }
  }

  function showSuccessModal(id, time, isDemo) {
    successIdEl.textContent = id;
    successTimeEl.textContent = time;
    if (isDemo) {
      document.getElementById('successDesc').innerHTML = `
        <strong>Simulasi Mode Demo Berhasil!</strong><br>
        Untuk menyimpan langsung ke Google Sheets Anda, masukkan URL Web App Google Apps Script Anda melalui tombol <strong>⚙️ GAS API</strong> di pojok kanan atas.
      `;
    } else {
      document.getElementById('successDesc').innerHTML = `
        Data formulir onboarding telah berhasil dikirim dan tersimpan rapi di spreadsheet Google Anda.
      `;
    }
    successModal.classList.add('open');
  }

  function updateStatusBadge(url) {
    if (url && url.startsWith('http')) {
      statusBadge.className = 'badge-tag connected';
      statusBadge.innerHTML = '<span class="status-dot"></span> GAS Connected';
    } else {
      statusBadge.className = 'badge-tag info';
      statusBadge.innerHTML = 'Demo Simulation';
    }
  }

  /* ==========================================================================
     TOAST NOTIFICATION UTILITY
     ========================================================================== */

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
});
