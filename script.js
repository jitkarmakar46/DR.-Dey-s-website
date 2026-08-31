document.addEventListener('DOMContentLoaded', () => {
    // Mobile Menu Toggle
    const mobileToggle = document.getElementById('mobileToggle');
    const navLinks = document.getElementById('navLinks');

    mobileToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        const icon = mobileToggle.querySelector('i');
        if (navLinks.classList.contains('active')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-xmark');
        } else {
            icon.classList.remove('fa-xmark');
            icon.classList.add('fa-bars');
        }
    });

    // Close mobile menu on link click
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            mobileToggle.querySelector('i').classList.remove('fa-xmark');
            mobileToggle.querySelector('i').classList.add('fa-bars');
        });
    });

    // Form Handling
    const form = document.getElementById('appointmentForm');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const successMsg = document.getElementById('successMessage');
    const nextBtn = document.getElementById('nextStepBtn');
    const prevBtn = document.getElementById('prevStepBtn');
    const resetBtn = document.getElementById('resetBtn');

    // Date constraints
    const dateInput = document.getElementById('date');
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);

    // Step 1 -> Step 2
    nextBtn.addEventListener('click', () => {
        const dept = document.getElementById('department').value;
        const date = dateInput.value;
        const time = document.getElementById('time').value;

        if (!dept || !date || !time) {
            alert('Please select Department, Date, and Time to proceed.');
            return;
        }

        step1.classList.remove('active');
        step2.classList.add('active');
    });

    // Step 2 -> Step 1
    prevBtn.addEventListener('click', () => {
        step2.classList.remove('active');
        step1.classList.add('active');
    });

    // Submit Form
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const patientName = document.getElementById('patientName').value;
        const phone = document.getElementById('phone').value;
        const date = document.getElementById('date').value;

        // Mock API Call / Success State
        document.getElementById('displayPatientName').textContent = patientName;
        document.getElementById('displayDate').textContent = new Date(date).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        step2.classList.remove('active');
        successMsg.style.display = 'block';
    });

    // Reset Form
    resetBtn.addEventListener('click', () => {
        form.reset();
        successMsg.style.display = 'none';
        step1.classList.add('active');
    });
});
