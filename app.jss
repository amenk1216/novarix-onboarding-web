/**
 * ============================================================================
 * NOVARIX GLOBAL - Employee Onboarding Client Application
 * Document Ref: NG-HR-003 | Version: 3.0
 * ============================================================================
 */

(function () {
  'use strict';

  // ============================================================
  // KONFIGURASI BACKEND — URL GAS hardcode, tidak terekspos di UI
  // ============================================================
  const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxqvtofcNQEW-igPsZmMbr66UJ6l7x7a6o9U1Idv0gKbdd7elXGyFHA7aMdgs8azZRNtg/exec';

  // State
  let currentStep = 1;
  const totalSteps = 5;
  let hasDrawnSignature = false;
  let isDrawing = false;
  let sigPoints = [];
  let lastMidPoint = null;
  let currentSigMode = 'draw';
  let uploadedFileName = '';

  function initApp() {
    // DOM Elements
    const form = document.getElementById('onboardingForm');
    const btnPrev = document.getElementById('btnPrevStep');
    const btnNext = document.getElementById('btnNextStep');
    const btnSubmit = document.getElementById('btnSubmitForm');
    const btnAutofill = document.getElementById('btnAutofill');
    const stepperProgressFill = document.getElementById('stepperProgressFill');
    const sameAddressCheck = document.getElementById('sameAddressCheck');

    // Signature Elements
    const signatureCanvas = document.getElementById('signatureCanvas');
    const signatureCtx = signatureCanvas ? signatureCanvas.getContext('2d') : null;
    const btnClearSignature = document.getElementById('btnClearSignature');
    const signatureBox = document.getElementById('signatureBox');
    const tabModeDraw = document.getElementById('tabModeDraw');
    const tabModeUpload = document.getElementById('tabModeUpload');
    const drawSignatureContainer = document.getElementById('drawSignatureContainer');
    const uploadSignatureContainer = document.getElementById('uploadSignatureContainer');
    const sigUploadDropzone = document.getElementById('sigUploadDropzone');
    const sigFileInput = document.getElementById('sigFileInput');
    const btnBrowseSigFile = document.getElementById('btnBrowseSigFile');
    const btnRemoveSigFile = document.getElementById('btnRemoveSigFile');
    const uploadedSigPreviewImg = document.getElementById('uploadedSigPreviewImg');
    const sigFileName = document.getElementById('sigFileName');
    const sigUploadIdle = document.getElementById('sigUploadIdle');
    const sigUploadPreview = document.getElementById('sigUploadPreview');
    const sigValidIndicator = document.getElementById('sigValidIndicator');
    const sigStatusIcon = document.getElementById('sigStatusIcon');
    const sigStatusText = document.getElementById('sigStatusText');

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

    // Initialize Canvas
    initSignatureCanvas();

    // Initialize Repeaters with default initial rows
    initDefaultRepeaters();

    // Set today's date on declaration date
    const declarationDateInput = document.getElementById('declarationDate');
    if (declarationDateInput && !declarationDateInput.value) {
      const today = new Date().toISOString().split('T')[0];
      declarationDateInput.value = today;
    }

    // Set default declaration toggles
    setupDeclarationToggles();

    // Event Listeners
    if (btnNext) btnNext.addEventListener('click', () => goToStep(currentStep + 1));
    if (btnPrev) btnPrev.addEventListener('click', () => goToStep(currentStep - 1));

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
    if (btnAutofill) btnAutofill.addEventListener('click', populateSampleData);

    // Address sync
    if (sameAddressCheck) {
      sameAddressCheck.addEventListener('change', (e) => {
        if (e.target.checked) {
          const permAddr = document.getElementById('permanentAddress');
          const permCity = document.getElementById('permanentCityPostal');
          const currAddr = document.getElementById('currentAddress');
          const currCity = document.getElementById('currentCityPostal');
          if (permAddr && currAddr) currAddr.value = permAddr.value;
          if (permCity && currCity) currCity.value = permCity.value;
        }
      });
    }

    // Add repeater rows buttons
    const btnAddFamily = document.getElementById('btnAddFamily');
    if (btnAddFamily) btnAddFamily.addEventListener('click', () => addFamilyRow());

    const btnAddEducation = document.getElementById('btnAddEducation');
    if (btnAddEducation) btnAddEducation.addEventListener('click', () => addEducationRow());

    const btnAddEmployment = document.getElementById('btnAddEmployment');
    if (btnAddEmployment) btnAddEmployment.addEventListener('click', () => addEmploymentRow());

    const btnAddReference = document.getElementById('btnAddReference');
    if (btnAddReference) btnAddReference.addEventListener('click', () => addReferenceRow());

    // Review & Print Preview using official 5-page template
    if (btnReviewPreview) {
      btnReviewPreview.addEventListener('click', () => {
        populatePrintTemplate();
        window.print();
      });
    }

    // Success Modal actions
    if (btnCloseSuccess && successModal) {
      btnCloseSuccess.addEventListener('click', () => {
        successModal.classList.remove('open');
        goToStep(1);
        if (form) form.reset();
        clearSignature();
        initDefaultRepeaters();
      });
    }

    if (btnPrintSubmission) {
      btnPrintSubmission.addEventListener('click', () => {
        populatePrintTemplate();
        window.print();
      });
    }

    // Also trigger populatePrintTemplate before browser's native print (Ctrl+P / Cmd+P)
    window.addEventListener('beforeprint', populatePrintTemplate);

    // Form Submission
    if (form) {
      form.addEventListener('submit', handleFormSubmit);
    }

    // Update Stepper Progress UI & Alignment
    updateStepperUI();
    window.addEventListener('resize', alignStepperTrack);
    window.addEventListener('load', alignStepperTrack);

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

      if (currentStep === 5) {
        setTimeout(resizeSignatureCanvas, 100);
      }

      // Scroll smoothly to top of card
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }

    function alignStepperTrack() {
      const stepperList = document.querySelector('.stepper-list');
      const stepperTrack = document.getElementById('stepperTrack');
      const bubbles = document.querySelectorAll('.step-item .step-bubble');
      if (!stepperList || !stepperTrack || bubbles.length < 2) return;

      const firstBubble = bubbles[0];
      const lastBubble = bubbles[bubbles.length - 1];
      const listRect = stepperList.getBoundingClientRect();
      const firstRect = firstBubble.getBoundingClientRect();
      const lastRect = lastBubble.getBoundingClientRect();

      if (listRect.width > 0 && firstRect.width > 0 && lastRect.width > 0) {
        const startX = (firstRect.left + firstRect.width / 2) - listRect.left;
        const endX = (lastRect.left + lastRect.width / 2) - listRect.left;
        const centerY = (firstRect.top + firstRect.height / 2) - listRect.top;

        stepperTrack.style.left = `${startX}px`;
        stepperTrack.style.width = `${endX - startX}px`;
        stepperTrack.style.top = `${centerY}px`;
      }
    }

    function updateStepperUI() {
      if (btnPrev) btnPrev.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
      if (currentStep === totalSteps) {
        if (btnNext) btnNext.style.display = 'none';
        if (btnSubmit) btnSubmit.style.display = 'inline-flex';
      } else {
        if (btnNext) btnNext.style.display = 'inline-flex';
        if (btnSubmit) btnSubmit.style.display = 'none';
      }

      document.querySelectorAll('.step-item').forEach(item => {
        const stepNum = parseInt(item.getAttribute('data-step'), 10);
        item.classList.remove('active', 'completed');
        if (stepNum === currentStep) {
          item.classList.add('active');
        } else if (stepNum < currentStep) {
          item.classList.add('completed');
        }
      });

      if (stepperProgressFill) {
        const progressPercent = ((currentStep - 1) / (totalSteps - 1)) * 100;
        stepperProgressFill.style.width = `${progressPercent}%`;
      }

      alignStepperTrack();
    }

    function validateCurrentStep() {
      const currentStepEl = document.getElementById(`stepContent${currentStep}`);
      if (!currentStepEl) return true;

      // Specific Step 5 validation
      if (currentStep === 5) {
        const consent = document.getElementById('declarationConsent');
        if (!consent || !consent.checked) {
          showToast('Anda harus mencentang persetujuan pernyataan karyawan.', 'error');
          return false;
        }
        if (!hasDrawnSignature) {
          showToast('Mohon berikan tanda tangan digital Anda (gambar langsung atau upload file gambar).', 'warning');
          if (signatureBox) signatureBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return false;
        }
      }

      const requiredInputs = currentStepEl.querySelectorAll('input[required], select[required], textarea[required]');
      for (const input of requiredInputs) {
        if (!input.checkValidity()) {
          input.reportValidity();
          const labelText = input.closest('.form-group')?.querySelector('label')?.innerText.replace('*', '').trim() || 'wajib';
          showToast(`Mohon lengkapi kolom "${labelText}"`, 'warning');
          input.focus();
          return false;
        }
      }

      return true;
    }

    /* ==========================================================================
       DIGITAL SIGNATURE (SMOOTH CANVAS & FILE UPLOAD ENGINE)
       ========================================================================== */

    function initSignatureCanvas() {
      if (!signatureCanvas || !signatureCtx) return;
      resizeSignatureCanvas();

      // Mouse handlers
      signatureCanvas.addEventListener('mousedown', (e) => {
        startDrawing(e);
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        drawSmooth(e);
      });

      window.addEventListener('mouseup', () => {
        if (isDrawing) stopDrawing();
      });

      // Touch handlers (silky smooth on iPad, smartphones, touchscreen laptops)
      signatureCanvas.addEventListener('touchstart', (e) => {
        if (e.target === signatureCanvas) e.preventDefault();
        startDrawing(e);
      }, { passive: false });

      signatureCanvas.addEventListener('touchmove', (e) => {
        if (e.target === signatureCanvas) e.preventDefault();
        if (!isDrawing) return;
        drawSmooth(e);
      }, { passive: false });

      signatureCanvas.addEventListener('touchend', () => {
        if (isDrawing) stopDrawing();
      });

      if (btnClearSignature) {
        btnClearSignature.addEventListener('click', () => {
          clearSignature();
          showToast('Tanda tangan dihapus. Silakan buat atau upload kembali.', 'info');
        });
      }

      // Tab switcher handlers
      if (tabModeDraw && tabModeUpload) {
        tabModeDraw.addEventListener('click', () => switchSigMode('draw'));
        tabModeUpload.addEventListener('click', () => switchSigMode('upload'));
      }

      // Setup file upload dropzone
      setupSignatureUpload();
    }

    function switchSigMode(mode) {
      currentSigMode = mode;
      if (mode === 'draw') {
        if (tabModeDraw) tabModeDraw.classList.add('active');
        if (tabModeUpload) tabModeUpload.classList.remove('active');
        if (drawSignatureContainer) drawSignatureContainer.style.display = 'block';
        if (uploadSignatureContainer) uploadSignatureContainer.style.display = 'none';
        setTimeout(resizeSignatureCanvas, 50);
      } else {
        if (tabModeUpload) tabModeUpload.classList.add('active');
        if (tabModeDraw) tabModeDraw.classList.remove('active');
        if (uploadSignatureContainer) uploadSignatureContainer.style.display = 'block';
        if (drawSignatureContainer) drawSignatureContainer.style.display = 'none';
      }
    }

    function setupSignatureUpload() {
      if (!sigUploadDropzone || !sigFileInput) return;

      if (btnBrowseSigFile) {
        btnBrowseSigFile.addEventListener('click', (e) => {
          e.stopPropagation();
          sigFileInput.click();
        });
      }

      sigUploadDropzone.addEventListener('click', () => {
        if (hasDrawnSignature && uploadedFileName) return;
        sigFileInput.click();
      });

      sigFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleSignatureFile(e.target.files[0]);
        }
      });

      // Drag and drop events
      ['dragenter', 'dragover'].forEach(evtName => {
        sigUploadDropzone.addEventListener(evtName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          sigUploadDropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(evtName => {
        sigUploadDropzone.addEventListener(evtName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          sigUploadDropzone.classList.remove('dragover');
        });
      });

      sigUploadDropzone.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleSignatureFile(e.dataTransfer.files[0]);
        }
      });

      if (btnRemoveSigFile) {
        btnRemoveSigFile.addEventListener('click', (e) => {
          e.stopPropagation();
          clearSignature();
          showToast('Gambar tanda tangan dihapus.', 'info');
        });
      }
    }

    function handleSignatureFile(file) {
      if (!file) return;
      const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!allowed.includes(file.type)) {
        showToast('Format file tidak didukung! Mohon pilih gambar PNG, JPG, JPEG, atau WebP.', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('Ukuran file gambar terlalu besar! Maksimal 5 MB.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        const dataUrl = e.target.result;
        const img = new Image();
        img.onload = function() {
          const dpr = window.devicePixelRatio || 1;
          const canvasW = signatureCanvas.width / dpr;
          const canvasH = signatureCanvas.height / dpr;

          signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);

          const padX = 24;
          const padY = 16;
          const maxW = canvasW - padX * 2;
          const maxH = canvasH - padY * 2;
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const drawX = (canvasW - drawW) / 2;
          const drawY = (canvasH - drawH) / 2;

          signatureCtx.drawImage(img, drawX, drawY, drawW, drawH);

          uploadedFileName = file.name;
          const sizeKb = (file.size / 1024).toFixed(1);

          if (uploadedSigPreviewImg) uploadedSigPreviewImg.src = dataUrl;
          if (sigFileName) sigFileName.textContent = `${file.name} (${sizeKb} KB)`;
          if (sigUploadIdle) sigUploadIdle.style.display = 'none';
          if (sigUploadPreview) sigUploadPreview.style.display = 'flex';
          sigUploadDropzone.classList.add('has-file');

          updateSignatureState(true, `File: ${file.name}`);
          showToast('Gambar tanda tangan berhasil dimuat!', 'success');
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }

    function resizeSignatureCanvas() {
      if (!signatureCanvas || !signatureCtx) return;
      const dpr = window.devicePixelRatio || 1;
      const parentWidth = signatureBox ? signatureBox.clientWidth - 32 : 650;
      const displayWidth = parentWidth > 50 ? parentWidth : 650;

      // Preserve existing content if already drawn
      let tempImage = null;
      if (hasDrawnSignature && signatureCanvas.width > 0 && signatureCanvas.height > 0) {
        try {
          tempImage = signatureCanvas.toDataURL('image/png');
        } catch (e) {}
      }

      signatureCanvas.width = displayWidth * dpr;
      signatureCanvas.height = 180 * dpr;
      signatureCanvas.style.width = displayWidth + 'px';
      signatureCanvas.style.height = '180px';

      signatureCtx.scale(dpr, dpr);
      signatureCtx.lineWidth = 2.4;
      signatureCtx.lineCap = 'round';
      signatureCtx.lineJoin = 'round';
      signatureCtx.strokeStyle = '#0f172a';

      if (tempImage) {
        const img = new Image();
        img.onload = () => {
          signatureCtx.drawImage(img, 0, 0, displayWidth, 180);
        };
        img.src = tempImage;
      }
    }

    function getCanvasPos(e) {
      const rect = signatureCanvas.getBoundingClientRect();
      const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    }

    function startDrawing(e) {
      isDrawing = true;
      const pos = getCanvasPos(e);
      sigPoints = [pos];
      lastMidPoint = pos;

      // Draw dot on initial click/tap
      signatureCtx.beginPath();
      signatureCtx.arc(pos.x, pos.y, signatureCtx.lineWidth / 2, 0, Math.PI * 2);
      signatureCtx.fillStyle = '#0f172a';
      signatureCtx.fill();

      hasDrawnSignature = true;
      updateSignatureState(true, 'Digambar langsung');
    }

    function drawSmooth(e) {
      if (!isDrawing) return;
      const pos = getCanvasPos(e);
      sigPoints.push(pos);

      if (sigPoints.length < 2) return;

      const p1 = sigPoints[sigPoints.length - 2];
      const p2 = sigPoints[sigPoints.length - 1];

      // Midpoint quadratic interpolation for ultra-smooth ink curve
      const midPoint = {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2
      };

      signatureCtx.beginPath();
      signatureCtx.moveTo(lastMidPoint.x, lastMidPoint.y);
      signatureCtx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
      signatureCtx.stroke();

      lastMidPoint = midPoint;
      hasDrawnSignature = true;
      updateSignatureState(true, 'Digambar langsung');
    }

    function stopDrawing() {
      if (!isDrawing) return;
      if (sigPoints.length > 1 && lastMidPoint) {
        const lastP = sigPoints[sigPoints.length - 1];
        signatureCtx.beginPath();
        signatureCtx.moveTo(lastMidPoint.x, lastMidPoint.y);
        signatureCtx.lineTo(lastP.x, lastP.y);
        signatureCtx.stroke();
      }
      isDrawing = false;
      sigPoints = [];
      lastMidPoint = null;
    }

    function clearSignature() {
      if (!signatureCtx) return;
      signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
      hasDrawnSignature = false;
      sigPoints = [];
      lastMidPoint = null;
      uploadedFileName = '';

      if (sigFileInput) sigFileInput.value = '';
      if (sigUploadIdle) sigUploadIdle.style.display = 'flex';
      if (sigUploadPreview) sigUploadPreview.style.display = 'none';
      if (sigUploadDropzone) sigUploadDropzone.classList.remove('has-file');
      if (uploadedSigPreviewImg) uploadedSigPreviewImg.src = '';

      updateSignatureState(false);
    }

    function updateSignatureState(isValid, detail = '') {
      hasDrawnSignature = isValid;
      if (signatureBox) {
        if (isValid) signatureBox.classList.add('has-signature');
        else signatureBox.classList.remove('has-signature');
      }

      if (sigValidIndicator && sigStatusIcon && sigStatusText) {
        if (isValid) {
          sigValidIndicator.className = 'sig-valid-indicator valid';
          sigStatusIcon.textContent = '✅';
          sigStatusText.textContent = `Tanda tangan siap (${detail || 'Tervalidasi'}).`;
        } else {
          sigValidIndicator.className = 'sig-valid-indicator';
          sigStatusIcon.textContent = '⚠️';
          sigStatusText.textContent = 'Tanda tangan belum dibuat atau diunggah. Mohon tanda tangani sebelum submit.';
        }
      }
    }

    /* ==========================================================================
       REPEATERS (FAMILY, EDUCATION, EMPLOYMENT, REFERENCES)
       ========================================================================== */

    function initDefaultRepeaters() {
      if (familyRepeater) familyRepeater.innerHTML = '';
      if (educationRepeater) educationRepeater.innerHTML = '';
      if (employmentRepeater) employmentRepeater.innerHTML = '';
      if (referenceRepeater) referenceRepeater.innerHTML = '';

      addFamilyRow({ relationship: 'Spouse', name: '', nik: '', dob: '', genderOrOccupation: '' });
      addEducationRow({ level: 'University S1', institution: '', major: '', yearGraduated: '', gpa: '' });
      addEmploymentRow({ company: '', jobTitle: '', startDate: '', endDate: '', finalSalary: '', reasonForLeaving: '' });
      addReferenceRow({ name: '', companyAndTitle: '', relationship: 'Direct Supervisor', contactNumber: '', email: '' });
      addReferenceRow({ name: '', companyAndTitle: '', relationship: 'Colleague', contactNumber: '', email: '' });
    }

    function addFamilyRow(data = {}) {
      if (!familyRepeater) return;
      const index = familyRepeater.children.length + 1;
      const card = document.createElement('div');
      card.className = 'repeater-card';
      card.innerHTML = `
        <div class="repeater-card-header">
          <span class="repeater-badge">Tanggungan / Family Member #${index}</span>
          <button type="button" class="btn-remove-row" onclick="this.closest('.repeater-card').remove()">
            ✕ Hapus / Delete
          </button>
        </div>
        <div class="form-grid">
          <div class="col-4 form-group">
            <label class="form-label">Hubungan / Relationship</label>
            <select class="form-select fam-rel">
              <option value="Spouse" ${data.relationship === 'Spouse' ? 'selected' : ''}>Pasangan (Istri/Suami) / Spouse</option>
              <option value="Child 1" ${data.relationship === 'Child 1' ? 'selected' : ''}>Anak 1 / Child 1</option>
              <option value="Child 2" ${data.relationship === 'Child 2' ? 'selected' : ''}>Anak 2 / Child 2</option>
              <option value="Child 3" ${data.relationship === 'Child 3' ? 'selected' : ''}>Anak 3 / Child 3</option>
              <option value="Child 4" ${data.relationship === 'Child 4' ? 'selected' : ''}>Anak 4 / Child 4</option>
              <option value="Child 5" ${data.relationship === 'Child 5' ? 'selected' : ''}>Anak 5 / Child 5</option>
              <option value="Other" ${data.relationship === 'Other' ? 'selected' : ''}>Lainnya / Other</option>
            </select>
          </div>
          <div class="col-4 form-group">
            <label class="form-label">Nama Lengkap / Full Name</label>
            <input type="text" class="form-input fam-name" placeholder="Nama lengkap / Full name" value="${data.name || ''}">
          </div>
          <div class="col-4 form-group">
            <label class="form-label">Nomor KTP / NIK (National ID)</label>
            <input type="text" class="form-input fam-nik" maxlength="16" placeholder="NIK 16 digit / 16-digit ID" value="${data.nik || ''}">
          </div>
          <div class="col-6 form-group">
            <label class="form-label">Tanggal Lahir / Date of Birth</label>
            <input type="date" class="form-input fam-dob" value="${data.dob || ''}">
          </div>
          <div class="col-6 form-group">
            <label class="form-label">Jenis Kelamin / Pekerjaan (Gender / Occupation)</label>
            <input type="text" class="form-input fam-occ" placeholder="Misal: Wanita / Karyawan Swasta (Female / Private Employee)" value="${data.genderOrOccupation || ''}">
          </div>
        </div>
      `;
      familyRepeater.appendChild(card);
    }

    function addEducationRow(data = {}) {
      if (!educationRepeater) return;
      const index = educationRepeater.children.length + 1;
      const card = document.createElement('div');
      card.className = 'repeater-card';
      card.innerHTML = `
        <div class="repeater-card-header">
          <span class="repeater-badge">Riwayat Pendidikan / Education #${index}</span>
          <button type="button" class="btn-remove-row" onclick="this.closest('.repeater-card').remove()">
            ✕ Hapus / Delete
          </button>
        </div>
        <div class="form-grid">
          <div class="col-3 form-group">
            <label class="form-label">Jenjang / Level</label>
            <select class="form-select edu-level">
              <option value="University S1" ${data.level === 'University S1' ? 'selected' : ''}>S1 / Bachelor's Degree</option>
              <option value="University S2" ${data.level === 'University S2' ? 'selected' : ''}>S2 / Master's Degree</option>
              <option value="University D3" ${data.level === 'University D3' ? 'selected' : ''}>D3 / Diploma</option>
              <option value="High School" ${data.level === 'High School' ? 'selected' : ''}>SMA/SMK / Senior High School</option>
              <option value="Certificate" ${data.level === 'Certificate' ? 'selected' : ''}>Sertifikasi Profesional / Certificate</option>
            </select>
          </div>
          <div class="col-4 form-group">
            <label class="form-label">Nama Institusi &amp; Universitas / Institution</label>
            <input type="text" class="form-input edu-inst" placeholder="Contoh: Universitas Indonesia" value="${data.institution || ''}">
          </div>
          <div class="col-3 form-group">
            <label class="form-label">Jurusan / Major &amp; Specialization</label>
            <input type="text" class="form-input edu-major" placeholder="Contoh: Ilmu Komputer / Computer Science" value="${data.major || ''}">
          </div>
          <div class="col-2 form-group">
            <label class="form-label">Tahun Lulus / Year</label>
            <input type="text" class="form-input edu-year" placeholder="YYYY" value="${data.yearGraduated || ''}">
          </div>
          <div class="col-3 form-group">
            <label class="form-label">IPK / GPA</label>
            <input type="text" class="form-input edu-gpa" placeholder="Contoh: 3.75" value="${data.gpa || ''}">
          </div>
        </div>
      `;
      educationRepeater.appendChild(card);
    }

    function addEmploymentRow(data = {}) {
      if (!employmentRepeater) return;
      const index = employmentRepeater.children.length + 1;
      const card = document.createElement('div');
      card.className = 'repeater-card';
      card.innerHTML = `
        <div class="repeater-card-header">
          <span class="repeater-badge">Pengalaman Kerja / Work History #${index}</span>
          <button type="button" class="btn-remove-row" onclick="this.closest('.repeater-card').remove()">
            ✕ Hapus / Delete
          </button>
        </div>
        <div class="form-grid">
          <div class="col-6 form-group">
            <label class="form-label">Nama Perusahaan / Company Name</label>
            <input type="text" class="form-input emp-comp" placeholder="Contoh: PT Nusantara Teknologi Digital" value="${data.company || ''}">
          </div>
          <div class="col-6 form-group">
            <label class="form-label">Posisi &amp; Jabatan / Job Title</label>
            <input type="text" class="form-input emp-title" placeholder="Contoh: Lead Solutions Architect / Project Manager" value="${data.jobTitle || ''}">
          </div>
          <div class="col-3 form-group">
            <label class="form-label">Mulai / Start (MM/YYYY)</label>
            <input type="text" class="form-input emp-start" placeholder="01/2021" value="${data.startDate || ''}">
          </div>
          <div class="col-3 form-group">
            <label class="form-label">Selesai / End (MM/YYYY)</label>
            <input type="text" class="form-input emp-end" placeholder="Present / Saat ini" value="${data.endDate || ''}">
          </div>
          <div class="col-3 form-group">
            <label class="form-label">Gaji Terakhir / Final Salary (IDR)</label>
            <input type="text" class="form-input emp-salary" placeholder="Contoh: 22.000.000" value="${data.finalSalary || ''}">
          </div>
          <div class="col-3 form-group">
            <label class="form-label">Alasan Berhenti / Reason for Leaving</label>
            <input type="text" class="form-input emp-reason" placeholder="Contoh: Pengembangan karier / Career advancement" value="${data.reasonForLeaving || ''}">
          </div>
        </div>
      `;
      employmentRepeater.appendChild(card);
    }

    function addReferenceRow(data = {}) {
      if (!referenceRepeater) return;
      const index = referenceRepeater.children.length + 1;
      const card = document.createElement('div');
      card.className = 'repeater-card';
      card.innerHTML = `
        <div class="repeater-card-header">
          <span class="repeater-badge">Referensi Profesional / Professional Reference #${index}</span>
          <button type="button" class="btn-remove-row" onclick="this.closest('.repeater-card').remove()">
            ✕ Hapus / Delete
          </button>
        </div>
        <div class="form-grid">
          <div class="col-6 form-group">
            <label class="form-label">Nama Referensi / Reference Name</label>
            <input type="text" class="form-input ref-name" placeholder="Nama atasan / rekan kerja (Supervisor / colleague)" value="${data.name || ''}">
          </div>
          <div class="col-6 form-group">
            <label class="form-label">Perusahaan &amp; Jabatan / Company &amp; Title</label>
            <input type="text" class="form-input ref-company" placeholder="Nama Perusahaan - Posisi (Company - Job Title)" value="${data.companyAndTitle || ''}">
          </div>
          <div class="col-4 form-group">
            <label class="form-label">Hubungan Kerja / Relationship</label>
            <input type="text" class="form-input ref-rel" placeholder="Contoh: Atasan Langsung / Direct Supervisor" value="${data.relationship || ''}">
          </div>
          <div class="col-4 form-group">
            <label class="form-label">Nomor Telepon / Contact Phone</label>
            <input type="tel" class="form-input ref-phone" placeholder="Contoh: 081198765432" value="${data.contactNumber || ''}">
          </div>
          <div class="col-4 form-group">
            <label class="form-label">Email Referensi / Email</label>
            <input type="email" class="form-input ref-email" placeholder="referensi@perusahaan.com" value="${data.email || ''}">
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
       AUTOFILL SAMPLE DATA (MOCK / SIMULATED DATA BILINGUAL)
       ========================================================================== */

    function populateSampleData() {
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      };

      // Step 1: Personal Particulars (Simulated Synthetic Data)
      setVal('fullName', 'Budi Pratama');
      setVal('preferredName', 'Budi');
      setVal('nik', '3171011505900001');
      setVal('passportNo', 'A9876543 / 2029-10-15');
      setVal('placeOfBirth', 'Jakarta');
      setVal('dateOfBirth', '1990-05-15');

      const genderMale = document.querySelector('input[name="gender"][value="Male"]');
      if (genderMale) genderMale.checked = true;

      setVal('bloodGroup', 'O');
      setVal('religion', 'Islam');

      const maritalMarried = document.querySelector('input[name="maritalStatus"][value="Married"]');
      if (maritalMarried) maritalMarried.checked = true;

      // Contact Details (Simulated Address)
      setVal('permanentAddress', 'Jl. Jenderal Sudirman Kav. 25, RT 003 / RW 002, Kel. Karet Tengsin, Kec. Tanah Abang');
      setVal('permanentCityPostal', 'Jakarta Pusat / 10220');
      setVal('currentAddress', 'Jl. Jenderal Sudirman Kav. 25, RT 003 / RW 002, Kel. Karet Tengsin, Kec. Tanah Abang');
      setVal('currentCityPostal', 'Jakarta Pusat / 10220');
      setVal('mobileNumber', '081234567890');
      setVal('personalEmail', 'budi.pratama.simulasi@example.com');
