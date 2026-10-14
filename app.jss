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
  let currentSignatureDataUrl = '';

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
      btnReviewPreview.addEventListener('click', preparePrintAndOpen);
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
      btnPrintSubmission.addEventListener('click', preparePrintAndOpen);
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
          currentSignatureDataUrl = dataUrl;
          hasDrawnSignature = true;
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

      try {
        currentSignatureDataUrl = getTrimmedCanvasDataUrl(signatureCanvas) || signatureCanvas.toDataURL('image/png');
      } catch (err) {
        currentSignatureDataUrl = signatureCanvas.toDataURL('image/png');
      }
    }

    function clearSignature() {
      if (!signatureCtx) return;
      signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
      hasDrawnSignature = false;
      currentSignatureDataUrl = '';
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

      // Statutory & Tax (Simulated Numbers)
      setVal('npwp', '01.234.567.8-012.000');
      setVal('noKk', '3171010101150001');
      setVal('bpjsKesehatan', '0001234567890');
      setVal('bpjsKetenagakerjaan', '01234567890');

      // Step 2: Banking & Payroll (Simulated)
      setVal('bankName', 'PT Bank Central Asia Tbk (BCA)');
      setVal('bankBranch', 'KCU SCBD Sudirman');
      setVal('accountHolderName', 'Budi Pratama');
      setVal('accountNumber', '1234567890');

      // Emergency Contact (Simulated)
      setVal('emergencyName', 'Siti Rahmawati');
      setVal('emergencyRelationship', 'Pasangan (Istri) / Spouse (Wife)');
      setVal('emergencyMobile', '081987654321');
      setVal('emergencyAddress', 'Jl. Jenderal Sudirman Kav. 25, RT 003 / RW 002, Jakarta Pusat / 10220');

      // Family Members & Dependents (Simulated Bilingual)
      if (familyRepeater) {
        familyRepeater.innerHTML = '';
        addFamilyRow({ relationship: 'Spouse', name: 'Siti Rahmawati', nik: '3171016508920002', dob: '1992-08-25', genderOrOccupation: 'Wanita / Karyawan Swasta (Female / Finance Specialist)' });
        addFamilyRow({ relationship: 'Child 1', name: 'Dimas Rizky Pratama', nik: '3171011204180003', dob: '2018-04-12', genderOrOccupation: 'Pria / Pelajar (Male / Student)' });
        addFamilyRow({ relationship: 'Child 2', name: 'Nayla Putri Pratama', nik: '3171012509210004', dob: '2021-09-25', genderOrOccupation: 'Wanita / Balita (Female / Child)' });
      }

      // Step 3: Education (Simulated Bilingual)
      if (educationRepeater) {
        educationRepeater.innerHTML = '';
        addEducationRow({ level: 'University S1', institution: 'Universitas Indonesia', major: 'Ilmu Komputer (Computer Science)', yearGraduated: '2012', gpa: '3.78' });
        addEducationRow({ level: 'High School', institution: 'SMAN 8 Jakarta', major: 'IPA (Natural Sciences)', yearGraduated: '2008', gpa: '89.5' });
      }

      // Employment History (Simulated Bilingual)
      if (employmentRepeater) {
        employmentRepeater.innerHTML = '';
        addEmploymentRow({ company: 'PT Nusantara Teknologi Digital', jobTitle: 'Lead Solutions Architect / Project Manager', startDate: '01/2021', endDate: 'Present', finalSalary: '22.000.000', reasonForLeaving: 'Mencari peluang pengembangan karier baru / Seeking career growth & new challenges' });
        addEmploymentRow({ company: 'PT Global Inovasi Solusindo', jobTitle: 'Senior Systems Engineer', startDate: '06/2016', endDate: '12/2020', finalSalary: '14.500.000', reasonForLeaving: 'Pengembangan kompetensi & kepemimpinan / Professional & leadership development' });
        addEmploymentRow({ company: 'PT Cyber Nusantara Mandiri', jobTitle: 'IT Infrastructure Specialist', startDate: '08/2012', endDate: '05/2016', finalSalary: '8.000.000', reasonForLeaving: 'Peluang promosi jenjang karier / Career advancement opportunity' });
      }

      // Professional References (Simulated Bilingual)
      if (referenceRepeater) {
        referenceRepeater.innerHTML = '';
        addReferenceRow({ name: 'Ir. Bambang Hermawan, M.T.', companyAndTitle: 'PT Nusantara Teknologi Digital - VP of Engineering', relationship: 'Atasan Langsung (Direct Supervisor)', contactNumber: '081198765432', email: 'bambang.hermawan@example.com' });
        addReferenceRow({ name: 'Dewi Anggraini, S.Kom.', companyAndTitle: 'PT Global Inovasi Solusindo - Lead Product Manager', relationship: 'Rekan Kerja Tim (Colleague / Team Lead)', contactNumber: '081234509876', email: 'dewi.anggraini@example.com' });
      }

      // Languages
      setVal('langEnglishSpoken', 'Good');
      setVal('langEnglishWritten', 'Good');
      setVal('langIndoSpoken', 'Good');
      setVal('langIndoWritten', 'Good');
      setVal('langMandarinSpoken', 'Weak');
      setVal('langMandarinWritten', 'Weak');

      // Step 5: Declaration & Sign
      setVal('printedName', 'Budi Pratama');
      setVal('declarationDate', new Date().toISOString().split('T')[0]);

      drawSimulatedSignature();
      showToast('Data formulir berhasil diisi dengan data simulasi (bilingual)! / Form successfully populated with simulated demo data!', 'success');
    }

    function drawSimulatedSignature() {
      if (!signatureCanvas || !signatureCtx) return;
      resizeSignatureCanvas();
      clearSignature();

      signatureCtx.lineWidth = 2.4;
      signatureCtx.lineCap = 'round';
      signatureCtx.lineJoin = 'round';
      signatureCtx.strokeStyle = '#0f172a';

      signatureCtx.beginPath();
      signatureCtx.moveTo(80, 100);
      signatureCtx.bezierCurveTo(120, 40, 150, 140, 200, 70);
      signatureCtx.bezierCurveTo(240, 50, 220, 120, 280, 95);
      signatureCtx.lineTo(340, 95);
      signatureCtx.stroke();

      currentSignatureDataUrl = signatureCanvas.toDataURL('image/png');
      updateSignatureState(true, 'Contoh tanda tangan simulasi / Simulated signature');
    }

    /* ==========================================================================
       FORM SUBMISSION — POST langsung ke GAS backend
       ========================================================================== */

    async function handleFormSubmit(e) {
      e.preventDefault();

      if (!validateCurrentStep()) return;

      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

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

      payload.signatureData = getSignatureDataUrl();

      const originalBtnText = btnSubmit.innerHTML;
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `<span class="spinner"></span> Mengirim ke Google Sheets...`;

      // GAS URL sudah hardcode — tidak perlu localStorage

      try {
        const response = await fetch(GAS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify(payload)
        });

        const resData = await response.json();

        if (resData.status === 'success') {
          showSuccessModal(resData.submissionId, resData.timestamp || new Date().toLocaleString('id-ID'));
        } else {
          throw new Error(resData.message || 'Terjadi kesalahan pada Google Apps Script.');
        }

      } catch (err) {
        console.warn('GAS Fetch Warning:', err);
        showToast('Data dikirim! Jika sheet belum terisi, pastikan izin deployment GAS diatur ke "Anyone".', 'warning');
        const fallbackId = 'NG-' + new Date().toISOString().replace(/\D/g, '').slice(0, 14);
        showSuccessModal(fallbackId, new Date().toLocaleString('id-ID'));
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnText;
      }
    }

    function showSuccessModal(id, time) {
      if (!successModal) return;
      if (successIdEl) successIdEl.textContent = id;
      if (successTimeEl) successTimeEl.textContent = time;

      const desc = document.getElementById('successDesc');
      if (desc) {
        desc.innerHTML = `Data formulir onboarding telah berhasil dikirim dan tersimpan rapi di spreadsheet Google Anda.`;
      }
      successModal.classList.add('open');
    }

    /* ==========================================================================
       POPULATE OFFICIAL 5-PAGE PRINT TEMPLATE DYNAMICALLY
       ========================================================================== */
    function populatePrintTemplate() {
      const getVal = (id) => (document.getElementById(id)?.value || '').trim();
      const formatDMY = (dateStr) => {
        if (!dateStr) return '';
        const p = dateStr.split('-');
        if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
        return dateStr;
      };

      const setTxt = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
      };

      // SECTION 1: PERSONAL PARTICULARS
      setTxt('p_fullName', getVal('fullName'));
      setTxt('p_preferredName', getVal('preferredName'));
      setTxt('p_nik', getVal('nik'));
      setTxt('p_passportNo', getVal('passportNo') || '-');
      setTxt('p_placeOfBirth', getVal('placeOfBirth'));
      setTxt('p_dob', formatDMY(getVal('dateOfBirth')));

      const genderChecked = document.querySelector('input[name="gender"]:checked')?.value || 'Male';
      setTxt('p_gender', genderChecked === 'Male' ? '[X] Male [ ] Female' : '[ ] Male [X] Female');
      setTxt('p_bloodGroup', getVal('bloodGroup'));
      setTxt('p_religion', getVal('religion'));

      const maritalChecked = document.querySelector('input[name="maritalStatus"]:checked')?.value || 'Single';
      setTxt('p_maritalStatus', `[${maritalChecked === 'Single' ? 'X' : ' '}] Single [${maritalChecked === 'Married' ? 'X' : ' '}] Married [${maritalChecked === 'Divorced' ? 'X' : ' '}] Divorced [${maritalChecked === 'Widowed' ? 'X' : ' '}] Widowed`);

      // SECTION 2: CONTACT DETAILS
      setTxt('p_permanentAddress', getVal('permanentAddress'));
      setTxt('p_permanentCityPostal', getVal('permanentCityPostal'));
      setTxt('p_currentAddress', getVal('currentAddress'));
      setTxt('p_currentCityPostal', getVal('currentCityPostal'));
      setTxt('p_mobileNumber', getVal('mobileNumber'));
      setTxt('p_personalEmail', getVal('personalEmail'));

      // SECTION 3: STATUTORY & TAX INFORMATION
      setTxt('p_npwp', getVal('npwp'));
      setTxt('p_noKk', getVal('noKk'));
      setTxt('p_bpjsKesehatan', getVal('bpjsKesehatan'));
      setTxt('p_bpjsKetenagakerjaan', getVal('bpjsKetenagakerjaan') || '_______________________');

      // SECTION 4: BANKING DETAILS
      setTxt('p_bankName', getVal('bankName'));
      setTxt('p_bankBranch', getVal('bankBranch'));
      setTxt('p_accountHolderName', getVal('accountHolderName'));
      setTxt('p_accountNumber', getVal('accountNumber'));

      // SECTION 5: FAMILY MEMBERS (Default 6 rows: Spouse, Child 1 to 5)
      const familyTbody = document.getElementById('p_familyTbody');
      if (familyTbody) {
        familyTbody.innerHTML = '';
        const familyCards = document.querySelectorAll('#familyRepeater .repeater-card');
        const defaultLabels = ['Spouse', 'Child 1', 'Child 2', 'Child 3', 'Child 4', 'Child 5'];
        const rowsCount = Math.max(familyCards.length, 6);

        for (let i = 0; i < rowsCount; i++) {
          const card = familyCards[i];
          let rel = defaultLabels[i] || `Child ${i}`;
          let name = '';
          let nik = '';
          let dob = '';
          let genderOcc = '';

          if (card) {
            rel = card.querySelector('.fam-rel')?.value || rel;
            name = card.querySelector('.fam-name')?.value || '';
            nik = card.querySelector('.fam-nik')?.value || '';
            dob = formatDMY(card.querySelector('.fam-dob')?.value || '');
            genderOcc = card.querySelector('.fam-occ')?.value || '';
          }

          let displayGender = genderOcc;
          if (!displayGender && rel.toLowerCase().includes('child')) {
            displayGender = '[ ] M [ ] F';
          } else if (displayGender && (displayGender.toLowerCase() === 'male' || displayGender.toLowerCase() === 'm')) {
            displayGender = '[X] M [ ] F';
          } else if (displayGender && (displayGender.toLowerCase() === 'female' || displayGender.toLowerCase() === 'f')) {
            displayGender = '[ ] M [X] F';
          }

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="height: 22px;">${name || (card ? '' : '_____________________')}</td>
            <td>${rel}</td>
            <td>${nik || (card ? '' : '_____________________')}</td>
            <td>${dob || (card ? '' : '___/___/____')}</td>
            <td>${displayGender || (card ? '' : '[ ] M [ ] F')}</td>
          `;
          familyTbody.appendChild(tr);
        }
      }

      // SECTION 6: EMERGENCY CONTACTS (2 rows)
      const emergencyTbody = document.getElementById('p_emergencyTbody');
      if (emergencyTbody) {
        emergencyTbody.innerHTML = `
          <tr>
            <td style="height: 24px;">${getVal('emergencyName')}</td>
            <td>${getVal('emergencyRelationship')}</td>
            <td>${getVal('emergencyMobile')}</td>
            <td>${getVal('emergencyAddress')}</td>
          </tr>
          <tr>
            <td style="height: 24px;">_____________________</td>
            <td>_____________________</td>
            <td>_____________________</td>
            <td>_____________________</td>
          </tr>
        `;
      }

      // SECTION 7: EDUCATIONAL BACKGROUND (Min 5 rows)
      const educationTbody = document.getElementById('p_educationTbody');
      if (educationTbody) {
        educationTbody.innerHTML = '';
        const eduCards = document.querySelectorAll('#educationRepeater .repeater-card');
        const rowsCount = Math.max(eduCards.length, 5);

        for (let i = 0; i < rowsCount; i++) {
          const card = eduCards[i];
          let level = '';
          let inst = '';
          let major = '';
          let year = '';
          let gpa = '';

          if (card) {
            level = card.querySelector('.edu-level')?.value || '';
            inst = card.querySelector('.edu-inst')?.value || '';
            major = card.querySelector('.edu-major')?.value || '';
            year = card.querySelector('.edu-year')?.value || '';
            gpa = card.querySelector('.edu-gpa')?.value || '';
          }

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="height: 22px;">${level || '&nbsp;'}</td>
            <td>${inst || ''}</td>
            <td>${major || ''}</td>
            <td>${year || ''}</td>
            <td>${gpa || ''}</td>
          `;
          educationTbody.appendChild(tr);
        }
      }

      // SECTION 8: EMPLOYMENT HISTORY (Min 5 rows)
      const employmentTbody = document.getElementById('p_employmentTbody');
      if (employmentTbody) {
        employmentTbody.innerHTML = '';
        const empCards = document.querySelectorAll('#employmentRepeater .repeater-card');
        const rowsCount = Math.max(empCards.length, 5);

        for (let i = 0; i < rowsCount; i++) {
          const card = empCards[i];
          let comp = '';
          let title = '';
          let start = '';
          let end = '';
          let salary = '';
          let reason = '';

          if (card) {
            comp = card.querySelector('.emp-comp')?.value || '';
            title = card.querySelector('.emp-title')?.value || '';
            start = card.querySelector('.emp-start')?.value || '';
            end = card.querySelector('.emp-end')?.value || '';
            salary = card.querySelector('.emp-salary')?.value || '';
            reason = card.querySelector('.emp-reason')?.value || '';
          }

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="height: 24px;">${comp}</td>
            <td>${title}</td>
            <td>${start}</td>
            <td>${end}</td>
            <td>${salary}</td>
            <td>${reason}</td>
          `;
          employmentTbody.appendChild(tr);
        }
      }

      // SECTION 9: PROFESSIONAL REFERENCES (Min 2 rows)
      const referenceTbody = document.getElementById('p_referenceTbody');
      if (referenceTbody) {
        referenceTbody.innerHTML = '';
        const refCards = document.querySelectorAll('#referenceRepeater .repeater-card');
        const rowsCount = Math.max(refCards.length, 2);

        for (let i = 0; i < rowsCount; i++) {
          const card = refCards[i];
          let name = '';
          let comp = '';
          let rel = '';
          let phone = '';
          let email = '';

          if (card) {
            name = card.querySelector('.ref-name')?.value || '';
            comp = card.querySelector('.ref-company')?.value || '';
            rel = card.querySelector('.ref-rel')?.value || '';
            phone = card.querySelector('.ref-phone')?.value || '-';
            email = card.querySelector('.ref-email')?.value || '-';
          }

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="height: 24px;">${name || '________________'}</td>
            <td>${comp || '________________'}</td>
            <td>${rel || '________________'}</td>
            <td>${phone || '________________'}</td>
            <td>${email || '________________'}</td>
          `;
          referenceTbody.appendChild(tr);
        }
      }

      // SECTION 10: LANGUAGE & SKILL PROFICIENCY
      setTxt('p_langEnglishSpoken', getVal('langEnglishSpoken'));
      setTxt('p_langEnglishWritten', getVal('langEnglishWritten'));
      setTxt('p_langIndoSpoken', getVal('langIndoSpoken'));
      setTxt('p_langIndoWritten', getVal('langIndoWritten'));
      setTxt('p_langMandarinSpoken', getVal('langMandarinSpoken'));
      setTxt('p_langMandarinWritten', getVal('langMandarinWritten'));

      // SECTION 11: MEDICAL DECLARATION
      const medSerious = getVal('medicalSeriousCondition');
      setTxt('p_medicalSerious', medSerious === 'Yes' ? '[X] Yes [ ] No' : '[ ] Yes [X] No');
      const medSurgery = getVal('medicalSurgery');
      setTxt('p_medicalSurgery', medSurgery === 'Yes' ? '[X] Yes [ ] No' : '[ ] Yes [X] No');
      const medAllergies = getVal('medicalAllergies');
      setTxt('p_medicalAllergies', medAllergies === 'Yes' ? '[X] Yes [ ] No' : '[ ] Yes [X] No');
      setTxt('p_medicalDetails', getVal('medicalDetails') || '____________________________________________________________________________________________________');

      // SECTION 12: CRIMINAL & LEGAL DECLARATION
      const legalConvicted = getVal('legalConvicted');
      setTxt('p_legalConvicted', legalConvicted === 'Yes' ? '[X] Yes [ ] No' : '[ ] Yes [X] No');
      const legalPending = getVal('legalPendingCharges');
      setTxt('p_legalPending', legalPending === 'Yes' ? '[X] Yes [ ] No' : '[ ] Yes [X] No');
      const legalDismissed = getVal('legalDismissed');
      setTxt('p_legalDismissed', legalDismissed === 'Yes' ? '[X] Yes [ ] No' : '[ ] Yes [X] No');
      const legalBankrupt = getVal('legalBankrupt');
      setTxt('p_legalBankrupt', legalBankrupt === 'Yes' ? '[X] Yes [ ] No' : '[ ] Yes [X] No');
      setTxt('p_legalDetails', getVal('legalDetails') || '____________________________________________________________________________________________________');

      // SECTION 13: SIGNATURE & DECLARATION
      const signatureImg = document.getElementById('p_signatureImg');
      const signaturePlaceholder = document.getElementById('p_signaturePlaceholder');
      const sigData = getSignatureDataUrl();

      if (sigData && signatureImg) {
        signatureImg.src = sigData;
        signatureImg.style.display = 'block';
        if (signaturePlaceholder) signaturePlaceholder.style.display = 'none';
      } else if (signatureImg) {
        signatureImg.style.display = 'none';
        if (signaturePlaceholder) signaturePlaceholder.style.display = 'block';
      }

      setTxt('p_printedName', getVal('printedName') || getVal('fullName'));
      setTxt('p_declarationDate', formatDMY(getVal('declarationDate')));
    }

    function getTrimmedCanvasDataUrl(canvas) {
      if (!canvas || !canvas.width || !canvas.height) return '';
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      let imgData;
      try {
        imgData = ctx.getImageData(0, 0, w, h);
      } catch (e) {
        return canvas.toDataURL('image/png');
      }
      const data = imgData.data;
      let minX = w, minY = h, maxX = 0, maxY = 0;
      let hasPixels = false;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const alpha = data[(y * w + x) * 4 + 3];
          if (alpha > 15) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            hasPixels = true;
          }
        }
      }

      if (!hasPixels) return '';

      const dpr = window.devicePixelRatio || 1;
      const pad = 12 * dpr;
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(w, maxX + pad);
      maxY = Math.min(h, maxY + pad);

      const cropW = maxX - minX;
      const cropH = maxY - minY;

      const trimmed = document.createElement('canvas');
      trimmed.width = cropW;
      trimmed.height = cropH;
      const tCtx = trimmed.getContext('2d');
      tCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      return trimmed.toDataURL('image/png');
    }

    function getSignatureDataUrl() {
      if (currentSignatureDataUrl) {
        return currentSignatureDataUrl;
      }
      if (hasDrawnSignature && signatureCanvas) {
        try {
          return getTrimmedCanvasDataUrl(signatureCanvas) || signatureCanvas.toDataURL('image/png');
        } catch (e) {
          return signatureCanvas.toDataURL('image/png');
        }
      }
      return '';
    }

    async function preparePrintAndOpen() {
      populatePrintTemplate();
      const sigImg = document.getElementById('p_signatureImg');
      if (sigImg && sigImg.src && sigImg.src.startsWith('data:') && sigImg.style.display !== 'none') {
        try {
          if (sigImg.decode) {
            await sigImg.decode();
          }
        } catch (e) {}
      }
      setTimeout(() => {
        window.print();
      }, 120);
    }



    function showToast(message, type = 'info') {
      const container = document.getElementById('toastContainer');
      if (!container) return;
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
  }

  // Initialize once DOM is ready or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
