        /* =============================================================================
         * FIREBASE INTEGRATION PREP
         * =============================================================================
         * The following placeholders and sync queue are set up for Firebase integration.
         * When ready to connect to Firebase:
         * 
         * 1. AUTH - Replace localStorage userProfile with Firebase Auth
         *    - Sign in with phone/email
         *    - Handle auth state changes
         *    - Link to: enqueueSyncEvent('auth.login', user)
         * 
         * 2. FIRESTORE - Replace localStorage sync queue with real-time sync
         *    - Jobs collection: real-time job listings
         *    - Users collection: profile data
         *    - Applications collection: job applications
         *    - Alerts collection: job alerts
         * 
         * 3. STORAGE - For profile pictures and job images
         * 
         * Current approach: Local storage + sync queue (enqueueSyncEvent)
         * Target approach: Firebase Firestore + Cloud Functions
         * ========================================================================== */

        // Firebase Config Placeholder - Replace with actual config
        const FIREBASE_CONFIG = {
            apiKey: "YOUR_API_KEY",
            authDomain: "YOUR_PROJECT.firebaseapp.com",
            projectId: "YOUR_PROJECT_ID",
            storageBucket: "YOUR_PROJECT.appspot.com",
            messagingSenderId: "YOUR_SENDER_ID",
            appId: "YOUR_APP_ID"
        };

        // Firebase initialization check
        const FIREBASE_READY = false; // Set to true after firebase.initializeApp()

        // Onboarding State
        let currentSlide = 0;
        let selectedRole = null;
        let selectedSkills = [];
        
        // Check if onboarding completed
        function checkOnboarding() {
            const onboardingDone = localStorage.getItem('onboardingComplete');
            const overlay = document.getElementById('onboardingOverlay');
            
            if (!onboardingDone) {
                overlay.classList.remove('hidden');
            } else {
                overlay.classList.add('hidden');
            }
        }
        
        // Welcome Slider
        function nextWelcomeSlide() {
            const slides = document.querySelectorAll('.welcome-slide');
            const dots = document.querySelectorAll('.welcome-dot');
            
            if (currentSlide < slides.length - 1) {
                currentSlide++;
                updateSlider();
            } else {
                showRoleSelection();
            }
        }
        
        function updateSlider() {
            const slider = document.getElementById('welcomeSlider');
            slider.style.transform = `translateX(-${currentSlide * 100}%)`;
            
            const dots = document.querySelectorAll('.welcome-dot');
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === currentSlide);
            });
            
            const btn = document.getElementById('welcomeNextBtn');
            btn.textContent = currentSlide === 2 ? 'ابدأ' : 'التالي';
        }
        
        // Dot click navigation
        document.querySelectorAll('.welcome-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                currentSlide = parseInt(dot.dataset.index);
                updateSlider();
            });
        });
        
        // Swipe support
        let touchStartX = 0;
        const slider = document.getElementById('welcomeSlider');
        
        slider.addEventListener('touchstart', e => touchStartX = e.touches[0].clientX);
        slider.addEventListener('touchend', e => {
            const diff = touchStartX - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) {
                if (diff > 0 && currentSlide < 2) {
                    currentSlide++;
                    updateSlider();
                } else if (diff < 0 && currentSlide > 0) {
                    currentSlide--;
                    updateSlider();
                }
            }
        });
        
        // Skip onboarding
        function skipOnboarding() {
            finishOnboarding();
        }
        
        // Show Role Selection
        function showRoleSelection() {
            document.getElementById('welcomeScreens').style.display = 'none';
            document.getElementById('roleSelection').classList.add('active');
        }
        
        // Role Selection
        function selectRole(role) {
            selectedRole = role;
            document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
            document.getElementById(role === 'seeker' ? 'roleSeeker' : 'roleEmployer').classList.add('selected');
            document.getElementById('roleContinueBtn').classList.add('active');
        }
        
        function continueAfterRole() {
            if (selectedRole === 'seeker') {
                showProfileCompletion();
            } else {
                finishOnboarding();
            }
        }
        
        // Profile Completion
        function showProfileCompletion() {
            document.getElementById('roleSelection').classList.remove('active');
            document.getElementById('profileCompletion').classList.add('active');
            
            // Setup skill selection
            document.querySelectorAll('.skill-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    const skill = opt.dataset.skill;
                    opt.classList.toggle('selected');
                    
                    if (opt.classList.contains('selected')) {
                        if (!selectedSkills.includes(skill)) {
                            selectedSkills.push(skill);
                        }
                    } else {
                        selectedSkills = selectedSkills.filter(s => s !== skill);
                    }
                });
            });
        }
        
        function saveOnboardingProfile() {
            const name = document.getElementById('onboardingName').value.trim();
            const phone = document.getElementById('onboardingPhone').value.trim();
            const district = document.getElementById('onboardingDistrict')?.value || '';
            
            if (!name) {
                showToast('⚠️ يرجى إدخال الاسم');
                return;
            }
            if (selectedSkills.length === 0) {
                showToast('⚠️ اختر مهارة واحدة على الأقل');
                return;
            }
            
            const profile = {
                name: name,
                phone: phone,
                role: selectedRole || 'seeker',
                skills: selectedSkills,
                district: district || "وسط المدينة",
                bio: '',
                rating: 4.8,
                verified: true,
                phoneVerified: Boolean(phone),
                isAvailable: true,
                bankDetails: ''
            };
            
            localStorage.setItem('userProfile', JSON.stringify(profile));
            localStorage.setItem('onboardingComplete', 'true');
            enqueueSyncEvent('profile.upsert', profile);
            
            document.getElementById('onboardingOverlay').classList.add('hidden');
            showToast('✅ تم إنشاء الملف!');
            renderProfile();
        }
        
        function finishOnboarding() {
            localStorage.setItem('onboardingComplete', 'true');
            document.getElementById('onboardingOverlay').classList.add('hidden');
        }
        
        // Data - Load from localStorage first, then merge with defaults
        let jobs = [];
        let jobsRenderToken = 0;
        let searchDebounceTimer = null;
        let currentCategory = 'all';
        let currentTab = 'jobs';
        let currentDateFilter = 'all';
        let currentSort = 'newest';
        let salaryRangeFilter = { min: null, max: null };
        const PULL_THRESHOLD = 82;
        let pullStartY = 0;
        let pullDistance = 0;
        let isPullTracking = false;
        let isPullRefreshing = false;
        const DEFAULT_REQUIREMENTS = [
            'الالتزام بالوقت وبدء الوردية في الموعد',
            'خبرة عملية لا تقل عن سنة في نفس المجال',
            'التواصل المهني مع المشرف وصاحب العمل'
        ];
        const DEFAULT_PAYMENT_HISTORY = [
            { id: 'p1', title: 'وردية تنظيف منزل', amount: 320, status: 'paid', paidAt: Date.now() - 3 * 24 * 60 * 60 * 1000 },
            { id: 'p2', title: 'وردية نقل أثاث', amount: 480, status: 'paid', paidAt: Date.now() - 9 * 24 * 60 * 60 * 1000 },
            { id: 'p3', title: 'وردية سباكة طارئة', amount: 260, status: 'pending', paidAt: Date.now() - 2 * 24 * 60 * 60 * 1000 },
            { id: 'p4', title: 'وردية دهان داخلي', amount: 410, status: 'pending', paidAt: Date.now() - 12 * 60 * 60 * 1000 }
        ];

        function escapeHtml(value) {
            return String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function formatCurrency(amount) {
            return `${Math.max(0, Number(amount) || 0)} درهم`;
        }

        function formatDateArabic(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleDateString('ar-MA', { day: 'numeric', month: 'long', year: 'numeric' });
        }

        function formatShiftDate(dateValue) {
            const date = new Date(dateValue);
            if (Number.isNaN(date.getTime())) return 'غير محدد';
            return date.toLocaleDateString('ar-MA', { weekday: 'long', day: 'numeric', month: 'long' });
        }

        function buildStars(rating = 0) {
            const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
            const filled = Math.round(safeRating);
            return `${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}`;
        }

        function getPaymentHistory() {
            try {
                const stored = JSON.parse(localStorage.getItem('paymentHistory') || '[]');
                if (Array.isArray(stored) && stored.length) return stored;
            } catch (error) {
                // fallback to generated history
            }

            const apps = JSON.parse(localStorage.getItem('myApplications') || '[]');
            if (apps.length) {
                return apps.slice(0, 5).map((app, index) => ({
                    id: `app-${app.id || index}`,
                    title: app.title || 'وردية عمل',
                    amount: Number(app.price) || 250,
                    status: index < 2 ? 'pending' : 'paid',
                    paidAt: Date.now() - (index + 1) * 24 * 60 * 60 * 1000
                }));
            }

            return DEFAULT_PAYMENT_HISTORY;
        }

        function summarizeEarnings(paymentHistory) {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            let totalEarned = 0;
            let thisMonth = 0;
            let pending = 0;

            paymentHistory.forEach(payment => {
                const amount = Number(payment.amount) || 0;
                const paidAtDate = new Date(payment.paidAt || Date.now());
                if (payment.status === 'pending') {
                    pending += amount;
                    return;
                }

                totalEarned += amount;
                if (paidAtDate.getMonth() === currentMonth && paidAtDate.getFullYear() === currentYear) {
                    thisMonth += amount;
                }
            });

            return { totalEarned, thisMonth, pending };
        }

        function resolvePostedAt(job, index = 0) {
            if (Number.isFinite(job.postedAt)) {
                return job.postedAt;
            }

            const now = Date.now();
            const postedValue = String(job.posted || '').trim();
            const hoursMatch = postedValue.match(/(\d+)\s*س/);

            if (hoursMatch) {
                return now - (parseInt(hoursMatch[1], 10) || 0) * 60 * 60 * 1000;
            }
            if (postedValue === 'الآن') {
                return now - 5 * 60 * 1000;
            }
            if (postedValue === 'يوم') {
                return now - 24 * 60 * 60 * 1000;
            }
            if (postedValue === 'أمس') {
                return now - 2 * 24 * 60 * 60 * 1000;
            }

            return now - (index + 1) * 60 * 60 * 1000;
        }

        function formatPostedAt(postedAt) {
            const diff = Date.now() - postedAt;
            const hour = 60 * 60 * 1000;
            const day = 24 * hour;

            if (diff < hour) return 'الآن';
            if (diff < day) return `${Math.max(1, Math.floor(diff / hour))} س`;
            if (diff < day * 2) return 'يوم';
            if (diff < day * 3) return 'أمس';

            const days = Math.max(2, Math.floor(diff / day));
            return `${days} أيام`;
        }

        function normalizeJob(job, index = 0) {
            const postedAt = resolvePostedAt(job, index);
            const min = Number(job.priceMin) || 0;
            const max = Number(job.priceMax) || min;
            const title = job.title || 'وظيفة جديدة';
            const desc = job.desc || '';
            const district = job.district || 'غير محدد';

            return {
                ...job,
                title,
                desc,
                district,
                category: job.category || 'أخرى',
                priceMin: Math.min(min, max),
                priceMax: Math.max(min, max),
                views: Number(job.views) || 0,
                applicants: Number(job.applicants) || 0,
                postedAt,
                searchIndex: normalizeSearchText(`${title} ${desc} ${district}`)
            };
        }

        function initData() {
            const savedMyJobs = JSON.parse(localStorage.getItem('myJobs') || '[]');
            const now = Date.now();
            const hour = 60 * 60 * 1000;
            const day = 24 * hour;

            const defaultJobs = [
            {id:1,title:'🧹 تنظيف شقة كبيرة',desc:'شقة 4 غرف في الباريو. تنظيف كامل مع غسيل سجاد.',district:'الباريو',category:'تنظيف',priceMin:300,priceMax:450,views:89,applicants:5,postedAt: now - hour},
            {id:2,title:'📦 نقل أثاث منزل',desc:'نقل أثاث من منزل قديم. أثاث ثقيل يتطلب 2 عمال.',district:'وسط المدينة',category:'نقل',priceMin:400,priceMax:600,views:156,applicants:8,postedAt: now - 2*hour},
            {id:3,title:'🚿 إصلاح صنوبر shower',desc:'صنوبرة الحمام تسرب ماء. إصلاح عاجل مطلوب.',district:'العلالي',category:'سباكة',priceMin:150,priceMax:300,views:234,applicants:12,postedAt: now - hour},
            {id:4,title:'⚡ تركيب مروحة سقف',desc:'تركيب مروحة سقف في غرفة النوم.',district:'كد يا',category:'كهرباء',priceMin:100,priceMax:150,views:45,applicants:3,postedAt: now - day},
            {id:5,title:'🎨 دهان صالون',desc:'دهان صالون حديث业务流程 40م. لون beige.',district:'مرتيل',category:'دهان',priceMin:800,priceMax:1200,views:67,applicants:4,postedAt: now - 2*day},
            {id:6,title:'🚪 تركيب باب خشبي',desc:'تركيب باب غرف نوم جديد.',district:'الميناء',category:'نجارة',priceMin:200,priceMax:350,views:34,applicants:2,postedAt: now - 3*day},
            {id:7,title:'❄️ صيانة تكييف',desc:'تكييف شباك لا يبرد. تحتاج صيانة.',district:'الوازيس',category:'تبريد',priceMin:200,priceMax:400,views:89,applicants:6,postedAt: now - day},
        ];
// REMOVED: const defaultJobs = [
                {id:1,title:'🧹 تنظيف شقة 3 غرف',desc:'شقة في الحي الحسني. تحتاج تنظيف كامل.',district:'الباريو',category:'تنظيف',priceMin:250,priceMax:350,views:145,applicants:8,postedAt: now - 2 * hour},
                {id:2,title:'📦 نقل أثاث',desc:'نقل أثاث من شقة لدور ثالث.',district:'وسط المدينة',category:'نقل',priceMin:200,priceMax:300,views:78,applicants:4,postedAt: now - 5 * hour},
                {id:3,title:'🚿 إصلاح تسرب مياه',desc:'أنبوب المطبخ يسرب.',district:'العلالي',category:'سباكة',priceMin:200,priceMax:400,views:234,applicants:12,postedAt: now - hour},
                {id:4,title:'⚡ تركيب ثلاجة',desc:'تركيب ثلاجة جديدة.',district:'كد يا',category:'كهرباء',priceMin:300,priceMax:450,views:56,applicants:3,postedAt: now - day},
                {id:5,title:'🎨 دهان غرفة',desc:'دهان غرفة نوم.',district:'وسط المدينة',category:'دهان',priceMin:400,priceMax:600,views:34,applicants:2,postedAt: now - 2 * day},
            ];

            const existingIds = new Set(defaultJobs.map(j => j.id));
            const newJobs = savedMyJobs.filter(j => !existingIds.has(j.id));
            jobs = [...newJobs, ...defaultJobs].map((job, index) => normalizeJob(job, index));
        }

        initData();

        const workers = [
            {id:1,name:'عبد الكريم',skill:'تنظيف',rating:4.9,jobs:234,phone:'+212661234567',district:'الباريو'},
            {id:2,name:'سعيد',skill:'نقل',rating:4.8,jobs:189,phone:'+212671234567',district:'وسط المدينة'},
            {id:3,name:'يونس',skill:'سباكة',rating:4.7,jobs:145,phone:'+212681234567',district:'العلالي'},
            {id:4,name:'حكيم',skill:'كهرباء',rating:4.9,jobs:98,phone:'+212691234567',district:'كد يا'},
            {id:5,name:'رشيد',skill:'دهان',rating:4.8,jobs:167,phone:'+212661334567',district:'مرتيل'},
            {id:6,name:'أمين',skill:'نجارة',rating:4.6,jobs:76,phone:'+212671334567',district:'الميناء'},
            {id:7,name:'عمر',skill:'تبريد',rating:4.7,jobs:112,phone:'+212681334567',district:'الوازيس'},
        ];
// REMOVED: const workers = [
            {id:1,name:'أحمد',skill:'سباكة',rating:4.9,jobs:145,phone:'+212612345678'},
            {id:2,name:'فاطمة',skill:'تنظيف',rating:4.8,jobs:234,phone:'+212661234567'},
            {id:3,name:'يوسف',skill:'نقل',rating:4.7,jobs:89,phone:'+212671345678'},
            {id:4,name:'كريم',skill:'كهرباء',rating:4.9,jobs:67,phone:'+212652456789'},
            {id:5,name:'سارة',skill:'دهان',rating:4.8,jobs:112,phone:'+212633567890'},
            {id:6,name:'محمد',skill:'سباكة',rating:4.6,jobs:45,phone:'+212644678901'},
            {id:7,name:'علي',skill:'نقل',rating:4.5,jobs:67,phone:'+212634567890'},
            {id:8,name:'نورة',skill:'تنظيف',rating:4.7,jobs:156,phone:'+212645678901},
            {id:9,name:'خالد',skill:'كهرباء',rating:4.8,jobs:98,phone:'+212646789012'},
            {id:10,name:'منى',skill:'دهان',rating:4.6,jobs:76,phone:'+212647890123'},
            {id:11,name:'سعيد',skill:'تبريد',rating:4.9,jobs:54,phone:'+212648901234'},
            {id:12,name:'رania',skill:'نجارة',rating:4.4,jobs:34,phone:'+212649012345'},
        ];
        
        /* =============================================================================
         * WORKERS FIREBASE SYNC (PREP)
         * =============================================================================
         * TODO: When connecting Firebase:
         * - Replace hardcoded workers array with Firestore query
         * - Watch 'workers' collection for real-time updates
         * - Add enqueueSyncEvent calls for worker actions
         * 
         * Example Firestore structure:
         * workers/{workerId} - { name, skill, rating, jobs, phone, verified, district }
         * ============================================================================= */
        
        // Workers search functionality
        let workerSearchQuery = '';
        
        const STORAGE_KEYS = {
            savedJobs: 'savedJobs',
            jobAlerts: 'jobAlerts',
            urgentJobs: 'urgentJobs'
        };
        let storageSnapshotCache = null;
        const SYNC_QUEUE_KEY = 'pendingSyncEvents';

        function enqueueSyncEvent(type, payload) {
            try {
                const queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
                queue.push({
                    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
                    type,
                    payload,
                    createdAt: Date.now()
                });
                // Keep queue bounded until Firebase sync is wired.
                localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue.slice(-120)));
            } catch (error) {
                // Ignore sync queue failures to avoid blocking UX.
            }
        }

        function getStoredIds(key) {
            try {
                const parsed = JSON.parse(localStorage.getItem(key) || '[]');
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                return [];
            }
        }

        function setStoredIds(key, values) {
            localStorage.setItem(key, JSON.stringify(values));
            storageSnapshotCache = null;
        }

        function getStorageSnapshot(forceRefresh = false) {
            if (!storageSnapshotCache || forceRefresh) {
                storageSnapshotCache = {
                    savedJobs: new Set(getStoredIds(STORAGE_KEYS.savedJobs)),
                    jobAlerts: new Set(getStoredIds(STORAGE_KEYS.jobAlerts)),
                    urgentJobs: new Set(getStoredIds(STORAGE_KEYS.urgentJobs))
                };
            }

            return storageSnapshotCache;
        }

        function toggleStoredId(key, id) {
            const values = getStoredIds(key);
            const index = values.indexOf(id);

            if (index === -1) {
                values.push(id);
                setStoredIds(key, values);
                return true;
            }

            values.splice(index, 1);
            setStoredIds(key, values);
            return false;
        }

        function isSavedJob(id, snapshot = getStorageSnapshot()) {
            return snapshot.savedJobs.has(id);
        }

        function isAlertEnabled(id, snapshot = getStorageSnapshot()) {
            return snapshot.jobAlerts.has(id);
        }

        function isUrgentJob(id, snapshot = getStorageSnapshot()) {
            return snapshot.urgentJobs.has(id);
        }

        function renderJobCard(job, options = {}) {
            const escapedTitle = job.title.replace(/'/g, "\\'");
            const showDelete = Boolean(options.showDelete);
            const storageSnapshot = options.storageSnapshot || getStorageSnapshot();
            const saved = isSavedJob(job.id, storageSnapshot);
            const alerted = isAlertEnabled(job.id, storageSnapshot);
            const urgent = isUrgentJob(job.id, storageSnapshot);
            const postedLabel = formatPostedAt(job.postedAt || Date.now());

            return `
                <div class="job-card ${urgent ? 'urgent-enabled' : ''}" id="job-${job.id}" onclick="openShiftModal(${job.id})">
                    <div class="job-header">
                        <span class="job-category">${job.category}</span>
                        <div class="job-header-side">
                            ${urgent ? '<span class="urgent-badge">URGENT</span>' : ''}
                            <span class="job-posted">${postedLabel}</span>
                        </div>
                    </div>
                    <h3 class="job-title">${job.title}</h3>
                    <p class="job-desc">${job.desc}</p>
                    <p class="job-location"><i class="fas fa-map-marker-alt"></i> ${job.district}</p>
                    <div class="job-pay">💰 ${job.priceMin} - ${job.priceMax} درهما</div>
                    <div class="job-stats"><span><i class="fas fa-eye"></i> ${job.views}</span><span><i class="fas fa-users"></i> ${job.applicants}</span></div>
                    <div class="job-actions">
                        <button class="btn btn-whatsapp" onclick="event.stopPropagation(); applyJob('${escapedTitle}',${job.priceMin})">
                            <i class="fab fa-whatsapp"></i> تقديم
                        </button>
                        <div class="engagement-actions">
                            <button type="button" class="icon-btn alert ${alerted ? 'active' : ''}" onclick="event.stopPropagation(); enableJobAlert(${job.id})" title="تنبيهات الوظيفة">
                                <i class="fas fa-bell"></i>
                            </button>
                            <button type="button" class="icon-btn urgent ${urgent ? 'active' : ''}" onclick="event.stopPropagation(); toggleJobUrgent(${job.id})" title="تحديد كعاجل">
                                <i class="fas fa-bolt"></i>
                            </button>
                            <button type="button" class="icon-btn share" onclick="event.stopPropagation(); shareJob(${job.id})" title="مشاركة">
                                <i class="fas fa-share-nodes"></i>
                            </button>
                            <button type="button" class="icon-btn save ${saved ? 'active' : ''}" onclick="event.stopPropagation(); toggleSaveJob(${job.id})" title="حفظ">
                                <i class="${saved ? 'fas' : 'far'} fa-heart"></i>
                            </button>
                        </div>
                        ${showDelete ? `<button class="btn btn-outline" onclick="event.stopPropagation(); unsaveJob(${job.id})"><i class="fas fa-trash"></i> حذف</button>` : ''}
                        <button class="btn btn-primary" onclick="event.stopPropagation(); applyJob(\'\${escapedTitle}\', \${job.priceMin})"><i class="fab fa-whatsapp"></i> واتساب</button>
                    </div>
                </div>
            `;
        }

        function normalizeSearchText(text) {
            return String(text || '')
                .toLowerCase()
                .normalize('NFKD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[\u064B-\u065F\u0670]/g, '')
                .replace(/[إأآٱ]/g, 'ا')
                .replace(/[ؤ]/g, 'و')
                .replace(/[ئ]/g, 'ي')
                .replace(/[ة]/g, 'ه')
                .replace(/[ى]/g, 'ي')
                .replace(/[^\u0600-\u06FFA-Za-z0-9\s]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function matchesSearch(job, rawSearch) {
            if (!rawSearch) return true;
            const queryTokens = normalizeSearchText(rawSearch).split(' ').filter(Boolean);
            if (!queryTokens.length) return true;

            const searchable = job.searchIndex || normalizeSearchText(`${job.title} ${job.desc} ${job.district}`);
            return queryTokens.every(token => searchable.includes(token));
        }

        function matchesDateFilter(job) {
            if (currentDateFilter === 'all') return true;

            const postedDate = new Date(job.postedAt);
            const now = new Date();

            if (currentDateFilter === 'today') {
                const startOfDay = new Date(now);
                startOfDay.setHours(0, 0, 0, 0);
                return postedDate >= startOfDay;
            }

            if (currentDateFilter === 'week') {
                const startOfWeek = new Date(now);
                const dayIndex = (startOfWeek.getDay() + 6) % 7;
                startOfWeek.setDate(startOfWeek.getDate() - dayIndex);
                startOfWeek.setHours(0, 0, 0, 0);
                return postedDate >= startOfWeek;
            }

            if (currentDateFilter === 'month') {
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                return postedDate >= startOfMonth;
            }

            return true;
        }

        function matchesSalaryFilter(job) {
            if (salaryRangeFilter.min !== null && job.priceMax < salaryRangeFilter.min) return false;
            if (salaryRangeFilter.max !== null && job.priceMin > salaryRangeFilter.max) return false;
            return true;
        }

        function applyJobSort(list) {
            const sorted = [...list];
            if (currentSort === 'oldest') {
                sorted.sort((a, b) => a.postedAt - b.postedAt);
            } else if (currentSort === 'salary_high') {
                sorted.sort((a, b) => (b.priceMax - a.priceMax) || (b.postedAt - a.postedAt));
            } else if (currentSort === 'salary_low') {
                sorted.sort((a, b) => (a.priceMin - b.priceMin) || (b.postedAt - a.postedAt));
            } else {
                sorted.sort((a, b) => b.postedAt - a.postedAt);
            }
            return sorted;
        }

        function getFilteredJobs() {
            const search = document.getElementById('searchInput')?.value || '';
            return applyJobSort(jobs.filter(job => {
                if (currentCategory !== 'all' && job.category !== currentCategory) return false;
                if (!matchesSearch(job, search)) return false;
                if (!matchesSalaryFilter(job)) return false;
                if (!matchesDateFilter(job)) return false;
                return true;
            }));
        }

        function setTotalJobsCount(value) {
            document.getElementById('totalJobs').textContent = value;
        }

        function renderJobSkeleton(count = 4) {
            const container = document.getElementById('jobsContainer');
            container.innerHTML = Array.from({ length: count }).map(() => `
                <div class="skeleton-card">
                    <div class="skeleton-line w-35"></div>
                    <div class="skeleton-line h-18"></div>
                    <div class="skeleton-line w-60"></div>
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line w-45 last"></div>
                </div>
            `).join('');
        }

        function renderJobsEmptyState() {
            const hasQuery = Boolean((document.getElementById('searchInput')?.value || '').trim());
            const hasSalary = salaryRangeFilter.min !== null || salaryRangeFilter.max !== null;
            const hasDate = currentDateFilter !== 'all';
            const hasCategory = currentCategory !== 'all';
            const hasAnyFilter = hasQuery || hasSalary || hasDate || hasCategory;
            const icon = hasAnyFilter ? 'fa-filter-circle-xmark' : 'fa-briefcase';
            const title = hasAnyFilter ? 'لا توجد نتائج مطابقة' : 'لا توجد وظائف متاحة حالياً';
            const text = hasAnyFilter
                ? 'جرّب توسيع نطاق الراتب، تغيير تاريخ النشر، أو حذف بعض كلمات البحث.'
                : 'سيتم عرض الوظائف الجديدة هنا فور نشرها.';

            return `
                <div class="empty">
                    <i class="fas ${icon}"></i>
                    <h3>${title}</h3>
                    <p>${text}</p>
                    ${hasAnyFilter ? '<button class="btn btn-outline" style="max-width: 220px; margin: 0 auto;" onclick="resetAdvancedFilters()">إلغاء كل الفلاتر</button>' : ''}
                </div>
            `;
        }

        function renderJobs(options = {}) {
            const { withLoading = false, delay = 260 } = options;
            if (currentTab !== 'jobs') return;

            if (withLoading) {
                const token = ++jobsRenderToken;
                renderJobSkeleton(4);
                setTimeout(() => {
                    if (token !== jobsRenderToken) return;
                    renderJobs({ withLoading: false });
                }, delay);
                return;
            }

            const container = document.getElementById('jobsContainer');
            const filtered = getFilteredJobs();

            if (filtered.length === 0) {
                container.innerHTML = renderJobsEmptyState();
                setTotalJobsCount(0);
                return;
            }

            const storageSnapshot = getStorageSnapshot();
            container.innerHTML = filtered.map(job => renderJobCard(job, { storageSnapshot })).join('');
            setTotalJobsCount(filtered.length);
        }
        
        function renderWorkers() {
            const container = document.getElementById('jobsContainer');
            setTotalJobsCount(workers.length);
            
            // Add filter chips for workers at the top
            const uniqueSkills = [...new Set(workers.map(w => w.skill))];
            let skillsFilterHTML = '<div style="display:flex;gap:8px;padding:12px 16px;overflow-x:auto;flex-wrap:wrap;margin-bottom:8px;">';
            skillsFilterHTML += `<span class="filter-chip active" onclick="filterWorkers('all', this)">الكل</span>`;
            uniqueSkills.forEach(skill => {
                skillsFilterHTML += `<span class="filter-chip" onclick="filterWorkers('${skill}', this)">${skill}</span>`;
            });
            skillsFilterHTML += '</div>';
            
            // Also add search to workers tab
            let searchHTML = '<div style="padding:0 16px 12px;"><input type="text" class="search-box" id="workerSearch" placeholder="ابحث عن عامل..." oninput="handleWorkerSearch(this.value)"></div>';
            
            container.innerHTML = searchHTML + skillsFilterHTML + '<div class="workers-grid">' + workers.map(w => `
                <div class="worker-card" onclick="contactWorker('${w.phone}','${w.name}')">
                    <div class="worker-avatar">${w.name[0]}</div>
                    <div class="worker-name">${w.name}</div>
                    <div class="worker-skill">${w.skill}</div>
                    <div class="worker-rating">⭐ ${w.rating}</div>
                </div>
            `).join('') + '</div>';
        }
        
        function handleWorkerSearch(query) {
            const filtered = workers.filter(w => 
                w.name.toLowerCase().includes(query.toLowerCase()) ||
                w.skill.toLowerCase().includes(query.toLowerCase())
            );
            const grid = document.querySelector('.workers-grid');
            if (grid) {
                grid.innerHTML = filtered.map(w => `
                    <div class="worker-card" onclick="contactWorker('${w.phone}','${w.name}')">
                        <div class="worker-avatar">${w.name[0]}</div>
                        <div class="worker-name">${w.name}</div>
                        <div class="worker-skill">${w.skill}</div>
                        <div class="worker-rating">⭐ ${w.rating}</div>
                    </div>
                `).join('');
            }
        }
        
        function renderSavedJobs() {
            const storageSnapshot = getStorageSnapshot();
            const saved = jobs.filter(j => storageSnapshot.savedJobs.has(j.id));
            const container = document.getElementById('jobsContainer');
            
            if (saved.length === 0) {
                container.innerHTML = '<div class="empty"><i class="fas fa-bookmark"></i><h3>لا توجد محفوظات</h3><p>احفظ الوظائف التي تهمك لتصل لها بسرعة لاحقاً.</p></div>';
                setTotalJobsCount(0);
                return;
            }
            
            container.innerHTML = saved.map(job => renderJobCard(job, { showDelete: true, storageSnapshot })).join('');
            setTotalJobsCount(saved.length);
        }
        
        function renderProfile() {
            const user = JSON.parse(localStorage.getItem('userProfile') || '{}');
            const myJobs = JSON.parse(localStorage.getItem('myJobs') || '[]');
            const apps = JSON.parse(localStorage.getItem('myApplications') || '[]');
            const saved = JSON.parse(localStorage.getItem('savedJobs') || '[]');
            setTotalJobsCount(myJobs.length);
            
            const name = user.name || 'مستخدم جديد';
            const bio = user.bio || 'لم تُضف نبذة';
            const phone = user.phone || 'أضف رقمك';
            const district = user.district || '';
            
            let html = `
                <div class="profile-header">
                    <div class="profile-avatar">${name.charAt(0) || '👤'}</div>
                    <div class="profile-name">${name}</div>
                    <div class="profile-bio">${bio}</div>
                    <div class="profile-phone">📱 ${phone}</div>
                    ${district ? '<div class="profile-district">📍 ' + district + '</div>' : ''}
                </div>
            `;
            
            if (user.skills && user.skills.length > 0) {
                html += '<div class="skills-container">' + user.skills.map(s => '<span class="skill-tag">' + s + '</span>').join('') + '</div>';
            }
            
            html += `
                <div style="padding: 0 16px; margin-bottom: 16px;">
                    <button class="btn btn-primary" style="width: 100%;" onclick="openModal('editProfile')">✏️ تعديل الملف</button>
                </div>
                <div class="stats-bar" style="margin: 0 16px 16px;">
                    <div class="stat-item"><div class="stat-value">${myJobs.length}</div><div class="stat-label">وظائفي</div></div>
                    <div class="stat-item"><div class="stat-value">${apps.length}</div><div class="stat-label">تقديماتي</div></div>
                    <div class="stat-item"><div class="stat-value">${saved.length}</div><div class="stat-label">محفوظات</div></div>
                </div>
            `;
            
            // My Posted Jobs Section
            if (myJobs.length > 0) {
                html += `
                <div style="padding: 0 16px; margin-bottom: 16px;">
                    <h3 style="margin-bottom: 10px; font-size: 1rem;">📋 وظائفي المنشورة</h3>
                    ${myJobs.map(job => `
                        <div style="background: rgba(255,255,255,0.94); border-radius: 14px; padding: 12px; margin-bottom: 8px; border: 1px solid var(--border);">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                <div>
                                    <div style="font-weight: 700; font-size: 0.9rem;">${job.title}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-secondary);">${job.district} • ${job.priceMin}-${job.priceMax}DH</div>
                                </div>
                                <div style="display:flex; gap: 6px;">
                                    <button onclick="editMyJob(${job.id})" style="background: var(--primary); color: white; border: none; padding: 5px 10px; border-radius: 8px; font-size: 0.75rem; cursor: pointer;">✏️</button>
                                    <button onclick="deleteMyJob(${job.id})" style="background: var(--danger); color: white; border: none; padding: 5px 10px; border-radius: 8px; font-size: 0.75rem; cursor: pointer;">🗑️</button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                `;
            }
            
            html += `
                <div class="settings-section">
                    <div class="settings-item"><span>🔔 الإشعارات</span><input type="checkbox" checked></div>
                    <div class="settings-item"><span>🌐 اللغة</span><span style="color:var(--text-secondary)">العربية</span></div>
                    <div class="settings-item" onclick="openModal('help')"><span>❓ المساعدة</span><span>›</span></div>
                    <div class="settings-item" onclick="openModal('terms')"><span>📄 الشروط</span><span>›</span></div>
                </div>
                <div style="padding: 16px;">
                    <button class="btn" style="width: 100%; background: var(--danger); color: white;" onclick="clearAllData()">🗑️ مسح البيانات</button>
                </div>
            `;
            
            document.getElementById('jobsContainer').innerHTML = html;
        // ========== EARNINGS TAB ==========

        function applyToJob(jobId) {
            const job = jobs.find(j => j.id === jobId);
            if (job) applyJob(job.title, job.priceMin);
        }

        function openShiftModal(jobId) {
            const job = jobs.find(j => j.id === jobId);
            if (!job) return;
            const employer = { name: job.employer || 'مستخدم', rating: 4.5 };
            const requirements = job.requirements || ['خبرة في العمل المطلوب'];
            const html = `
                <div class="shift-summary">
                    <h3>${job.title}</h3>
                    <p>${job.desc}</p>
                    <div class="shift-pay-pill">💰 ${job.priceMin}-${job.priceMax}DH</div>
                </div>
                <div class="shift-meta-grid">
                    <div class="shift-meta-item"><div class="shift-meta-label">📅</div><div class="shift-meta-value">${job.postedAt ? new Date(job.postedAt).toLocaleDateString('ar') : 'اليوم'}</div></div>
                    <div class="shift-meta-item"><div class="shift-meta-label">📍</div><div class="shift-meta-value">${job.district || 'غير محدد'}</div></div>
                    <div class="shift-meta-item"><div class="shift-meta-label">⏰</div><div class="shift-meta-value">${job.duration || '8 ساعات'}</div></div>
                    <div class="shift-meta-item"><div class="shift-meta-label">💵</div><div class="shift-meta-value">${job.priceMin}-${job.priceMax}DH</div></div>
                </div>
                <h4 style="margin:12px 0 8px;font-size:0.9rem;">المتطلبات:</h4>
                <ul class="shift-requirements">${requirements.map(r => `<li>✓ ${r}</li>`).join('')}</ul>
                <div class="shift-employer"><h4>👤 صاحب العمل</h4><p>${employer.name}</p><div class="employer-rating">⭐ ${employer.rating}</div></div>
                <button class="btn btn-primary" style="width:100%;margin-top:16px;" onclick="applyToJob(${job.id}); closeModal('shiftDetails');">🚀 تقديم الآن</button>
            `;
            document.getElementById('shiftDetailsBody').innerHTML = html;
            openModal('shiftDetails');
        }

        function renderEarnings() {
            const paymentHistory = getPaymentHistory();
            const { totalEarned, thisMonth, pending } = summarizeEarnings(paymentHistory);
            const html = `
                <div class="profile-shell">
                    <h3 class="section-title">💰 الأرباح</h3>
                    <div class="earnings-grid">
                        <div class="earning-card"><div class="earning-label">الإجمالي</div><div class="earning-value">${totalEarned} DH</div></div>
                        <div class="earning-card"><div class="earning-label">هذا الشهر</div><div class="earning-value">${thisMonth} DH</div></div>
                        <div class="earning-card"><div class="earning-label">معلق</div><div class="earning-value">${pending} DH</div></div>
                    </div>
                    <h4 class="section-title">📜 المدفوعات الأخيرة</h4>
                    <div class="payments-list">
                        ${paymentHistory.slice(0,5).map(p => `
                            <div class="payment-item">
                                <div class="payment-main"><div class="payment-title">${p.title}</div><div class="payment-date">${new Date(p.paidAt).toLocaleDateString('ar')}</div></div>
                                <div class="payment-side"><div class="payment-amount">+${p.amount} DH</div><div class="payment-status ${p.status}">${p.status==='paid'?'مدفوع':'معلق'}</div></div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            document.getElementById('jobsContainer').innerHTML = html;
        }
        }
        
        function toggleJobDiscoveryControls(show) {
            const searchInput = document.getElementById('searchInput');
            const categoryFilters = document.getElementById('categoryFilters');
            const advancedControls = document.getElementById('advancedControls');
            const pullIndicator = document.getElementById('pullRefreshIndicator');

            searchInput.style.display = show ? 'block' : 'none';
            categoryFilters.style.display = show ? 'flex' : 'none';
            advancedControls.classList.toggle('hidden', !show);

            if (!show) {
                pullIndicator.classList.remove('visible');
            } else if (!isPullRefreshing) {
                const label = pullIndicator.querySelector('span');
                if (label) label.textContent = '⬇️ اسحب للتحديث';
            }
        }

        // Navigation
        function showTab(tab, navItem) {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            if (navItem) navItem.classList.add('active');
            currentTab = tab;
            toggleJobDiscoveryControls(tab === 'jobs');
            
            if (tab === 'jobs') renderJobs({ withLoading: true });
            else if (tab === 'workers') renderWorkers();
            else if (tab === 'saved') renderSavedJobs();
            else if (tab === 'profile') renderProfile();
            else if (tab === 'earnings') renderEarnings();
        }
        
        function syncAdvancedFilterState() {
            const minValue = document.getElementById('salaryMinFilter').value;
            const maxValue = document.getElementById('salaryMaxFilter').value;
            const min = minValue === '' ? null : Number(minValue);
            const max = maxValue === '' ? null : Number(maxValue);

            salaryRangeFilter.min = Number.isFinite(min) && min >= 0 ? min : null;
            salaryRangeFilter.max = Number.isFinite(max) && max >= 0 ? max : null;

            if (salaryRangeFilter.min !== null && salaryRangeFilter.max !== null && salaryRangeFilter.min > salaryRangeFilter.max) {
                const temp = salaryRangeFilter.min;
                salaryRangeFilter.min = salaryRangeFilter.max;
                salaryRangeFilter.max = temp;
                document.getElementById('salaryMinFilter').value = salaryRangeFilter.min;
                document.getElementById('salaryMaxFilter').value = salaryRangeFilter.max;
            }

            currentDateFilter = document.getElementById('datePostedFilter').value;
            currentSort = document.getElementById('sortFilter').value;
        }

        function handleAdvancedFilterChange() {
            syncAdvancedFilterState();
            renderJobs({ withLoading: true, delay: 220 });
        }

        function handleSearchInput() {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                renderJobs({ withLoading: true, delay: 200 });
            }, 140);
        }

        function setCategory(cat, chipElement) {
            currentCategory = cat;
            document.querySelectorAll('#categoryFilters .filter-chip').forEach(c => c.classList.remove('active'));
            if (chipElement) chipElement.classList.add('active');
            renderJobs({ withLoading: true, delay: 220 });
        }

        function resetAdvancedFilters() {
            document.getElementById('searchInput').value = '';
            document.getElementById('salaryMinFilter').value = '';
            document.getElementById('salaryMaxFilter').value = '';
            document.getElementById('datePostedFilter').value = 'all';
            document.getElementById('sortFilter').value = 'newest';
            currentCategory = 'all';
            currentDateFilter = 'all';
            currentSort = 'newest';
            salaryRangeFilter = { min: null, max: null };

            document.querySelectorAll('#categoryFilters .filter-chip').forEach(c => c.classList.remove('active'));
            const firstChip = document.querySelector('#categoryFilters .filter-chip');
            if (firstChip) firstChip.classList.add('active');

            renderJobs({ withLoading: true, delay: 240 });
        }

        function updatePullIndicator(distance = 0) {
            const indicator = document.getElementById('pullRefreshIndicator');
            if (!indicator) return;
            const label = indicator.querySelector('span');

            if (isPullRefreshing) {
                indicator.classList.add('visible');
                if (label) label.textContent = '🔄 جاري تحديث الوظائف...';
                return;
            }

            if (distance <= 0 || currentTab !== 'jobs') {
                indicator.classList.remove('visible');
                if (label) label.textContent = '⬇️ اسحب للتحديث';
                return;
            }

            indicator.classList.add('visible');
            if (label) {
                label.textContent = distance >= PULL_THRESHOLD ? '🔄 حرر إصبعك للتحديث' : '⬇️ اسحب للتحديث';
            }
        }

        function triggerPullRefresh() {
            if (currentTab !== 'jobs' || isPullRefreshing) return;

            isPullRefreshing = true;
            updatePullIndicator(pullDistance);
            initData();
            renderJobs({ withLoading: true, delay: 320 });

            setTimeout(() => {
                isPullRefreshing = false;
                updatePullIndicator(0);
                showToast('✅ تم تحديث القائمة');
            }, 420);
        }

        function setupPullToRefresh() {
            document.addEventListener('touchstart', (event) => {
                if (currentTab !== 'jobs' || window.scrollY > 0 || isPullRefreshing) {
                    isPullTracking = false;
                    return;
                }
                pullStartY = event.touches[0].clientY;
                pullDistance = 0;
                isPullTracking = true;
            }, { passive: true });

            document.addEventListener('touchmove', (event) => {
                if (!isPullTracking) return;
                const currentY = event.touches[0].clientY;
                pullDistance = Math.max(0, Math.min(120, currentY - pullStartY));

                if (pullDistance > 0 && window.scrollY <= 0) {
                    event.preventDefault();
                    updatePullIndicator(pullDistance);
                }
            }, { passive: false });

            document.addEventListener('touchend', () => {
                if (!isPullTracking) return;
                if (pullDistance >= PULL_THRESHOLD) {
                    triggerPullRefresh();
                } else {
                    updatePullIndicator(0);
                }
                isPullTracking = false;
                pullDistance = 0;
            });
        }

        function refreshCurrentTab() {
            if (currentTab === 'jobs') {
                renderJobs();
            } else if (currentTab === 'saved') {
                renderSavedJobs();
            }
        }
        
        // Modal
        function openModal(type) {
            if (type === 'editProfile') {
                const user = JSON.parse(localStorage.getItem('userProfile') || '{}');
                document.getElementById('editName').value = user.name || '';
                document.getElementById('editPhone').value = user.phone || '';
                document.getElementById('editDistrict').value = user.district || '';
                document.getElementById('editBio').value = user.bio || '';
                document.querySelectorAll('.skill-check').forEach(cb => {
                    cb.checked = user.skills && user.skills.includes(cb.value);
                });
            }
            if (type === 'postJob') {
                const postJobModal = document.getElementById('postJobModal');
                delete postJobModal.dataset.editingId;
                postJobModal.querySelector('form')?.reset();
            }
            if (type === 'help') {
                document.getElementById('jobsContainer').innerHTML = `
                    <div class="empty">
                        <i class="fas fa-question-circle"></i>
                        <p>تواصل معنا على واتساب</p>
                        <button class="btn btn-primary" style="margin-top:16px" onclick="contactWorker('+212612345678','فريق الدعم')">📱 رسالة</button>
                    </div>
                `;
                return;
            }
            if (type === 'terms') {
                document.getElementById('jobsContainer').innerHTML = '<div style="padding:20px;line-height:2;text-align:right;"><h3>📄 الشروط</h3><p style="color:var(--text-secondary)">1. المنصة مجانية</p><p style="color:var(--text-secondary)">2. لا نتحمل مسؤولية الاتفاقات</p><p style="color:var(--text-secondary)">3. يجب الاحترام</p></div>';
                return;
            }
            document.getElementById(type + 'Modal').classList.add('active');
        }
        
        function closeModal(type) {
            const modal = document.getElementById(type + 'Modal');
            if (type === 'postJob') {
                delete modal.dataset.editingId;
                modal.querySelector('form')?.reset();
            }
            modal.classList.remove('active');
        }
        
        // Job Actions
        function saveJob(id) {
            if (isSavedJob(id)) {
                showToast('⚠️ محفوظ مسبقاً');
                return;
            }
            toggleSaveJob(id);
        }
        
        function unsaveJob(id) {
            const saved = getStoredIds(STORAGE_KEYS.savedJobs).filter(i => i !== id);
            setStoredIds(STORAGE_KEYS.savedJobs, saved);
            showToast('🗑️ تم الحذف');
            refreshCurrentTab();
        }

        function toggleSaveJob(id) {
            const enabled = toggleStoredId(STORAGE_KEYS.savedJobs, id);
            showToast(enabled ? '❤️ Saved!' : '🗑️ Removed from saved');
            refreshCurrentTab();
        }

        function enableJobAlert(id) {
            const alerts = getStoredIds(STORAGE_KEYS.jobAlerts);
            if (!alerts.includes(id)) {
                alerts.push(id);
                setStoredIds(STORAGE_KEYS.jobAlerts, alerts);
            }
            showToast('🔔 Alerts enabled!');
            refreshCurrentTab();
        }

        function toggleJobUrgent(id) {
            toggleStoredId(STORAGE_KEYS.urgentJobs, id);
            refreshCurrentTab();
        }

        function buildJobLink(id) {
            return `${window.location.origin}${window.location.pathname}#job-${id}`;
        }

        async function shareJob(id) {
            const link = buildJobLink(id);
            const copied = await copyTextToClipboard(link);
            if (copied) {
                showToast('📋 Link copied!');
            } else {
                showToast('⚠️ Could not copy link');
            }
        }

        async function copyTextToClipboard(text) {
            if (navigator.clipboard && window.isSecureContext) {
                try {
                    await navigator.clipboard.writeText(text);
                    return true;
                } catch (error) {
                    return false;
                }
            }

            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            textArea.style.pointerEvents = 'none';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            let copied = false;
            try {
                copied = document.execCommand('copy');
            } catch (error) {
                copied = false;
            }

            textArea.remove();
            return copied;
        }
        
        function applyJob(title, price) {
            const user = JSON.parse(localStorage.getItem('userProfile') || '{}');
            if (!user.phone) {
                showToast('⚠️ أضف رقمك أولاً!');
                openModal('editProfile');
                return;
            }
            
            // Save application
            const apps = JSON.parse(localStorage.getItem('myApplications') || '[]');
            const application = {id:Date.now(),title:title,price:price,date:new Date().toLocaleDateString('ar')};
            apps.unshift(application);
            localStorage.setItem('myApplications', JSON.stringify(apps));
            enqueueSyncEvent('application.create', application);
            
            // Open WhatsApp
            const msg = 'مرحبا! تقدمت للوظيفة: ' + title + ' - السعر: ' + price + 'DH';
            window.open('https://wa.me/' + user.phone.replace(/\s/g,'') + '?text=' + encodeURIComponent(msg), '_blank');
            showToast('✅ تم التقدم!');
        }
        
        function contactWorker(phone, name) {
            const msg = 'مرحبا ' + name + '! أريد استفدام خدماتك';
            window.open('https://wa.me/' + phone.replace(/\s/g,'') + '?text=' + encodeURIComponent(msg), '_blank');
        }
        
        // Form Submissions
        function submitJob(e) {
            e.preventDefault();
            const newJob = {
                id: Date.now(),
                title: document.getElementById('jobTitle').value,
                category: document.getElementById('jobCategory').value || 'أخرى',
                desc: document.getElementById('jobDesc').value,
                district: document.getElementById('jobDistrict').value,
                priceMin: parseInt(document.getElementById('jobPriceMin').value) || 0,
                priceMax: parseInt(document.getElementById('jobPriceMax').value) || 0,
                whatsapp: document.getElementById('jobWhatsapp').value.trim(),
                views: 0,
                applicants: 0,
                postedAt: Date.now(),
                isMyJob: true
            };
            
            // Save to localStorage
            const myJobs = JSON.parse(localStorage.getItem('myJobs') || '[]');
            myJobs.unshift(newJob);
            localStorage.setItem('myJobs', JSON.stringify(myJobs));
            enqueueSyncEvent('job.create', newJob);
            initData();
            
            showToast('🎉 تم النشر!');
            closeModal('postJob');
            e.target.reset();
            if (currentTab === 'jobs') {
                renderJobs({ withLoading: true, delay: 220 });
            }
        }
        
        function saveProfile(e) {
            e.preventDefault();
            const profile = {
                name: document.getElementById('editName').value,
                phone: document.getElementById('editPhone').value,
                district: document.getElementById('editDistrict').value,
                bio: document.getElementById('editBio').value,
                skills: Array.from(document.querySelectorAll('.skill-check:checked')).map(cb => cb.value)
            };
            localStorage.setItem('userProfile', JSON.stringify(profile));
            enqueueSyncEvent('profile.upsert', profile);
            showToast('✅ تم الحفظ!');
            closeModal('editProfile');
            renderProfile();
        }
        
        function clearAllData() {
            if (confirm('مسح كل البيانات؟')) {
                localStorage.clear();
                storageSnapshotCache = null;
                initData();
                showToast('🗑️ تم المسح');
                checkOnboarding();
                const jobsNavItem = document.querySelector('.bottom-nav .nav-item');
                showTab('jobs', jobsNavItem);
            }
        }
        
        function deleteMyJob(id) {
            if (!confirm('حذف هذه الوظيفة؟')) return;
            const myJobs = JSON.parse(localStorage.getItem('myJobs') || '[]');
            const filtered = myJobs.filter(j => j.id !== id);
            localStorage.setItem('myJobs', JSON.stringify(filtered));
            
            // Also remove from main jobs array
            jobs = jobs.filter(j => j.id !== id);
            
            enqueueSyncEvent('job.delete', { id });
            initData();
            showToast('🗑️ تم الحذف');
            renderProfile();
            // Refresh jobs list if on jobs tab
            if (currentTab === 'jobs') renderJobs();
        }
        
        function editMyJob(id) {
            const myJobs = JSON.parse(localStorage.getItem('myJobs') || '[]');
            const job = myJobs.find(j => j.id === id);
            if (!job) return;
            
            // Fill the form
            document.getElementById('jobTitle').value = job.title;
            document.getElementById('jobCategory').value = job.category;
            document.getElementById('jobDesc').value = job.desc;
            document.getElementById('jobDistrict').value = job.district;
            document.getElementById('jobPriceMin').value = job.priceMin;
            document.getElementById('jobPriceMax').value = job.priceMax;
            const fallbackPhone = JSON.parse(localStorage.getItem('userProfile') || '{}').phone || '';
            document.getElementById('jobWhatsapp').value = job.whatsapp || fallbackPhone;
            
            // Store the job ID being edited
            document.getElementById('postJobModal').dataset.editingId = id;
            
            // Show modal
            document.getElementById('postJobModal').classList.add('active');
        }
        
        // Override submitJob to handle edits
        const originalSubmitJob = submitJob;
        submitJob = function(e) {
            e.preventDefault();
            const modal = document.getElementById('postJobModal');
            const editingId = modal.dataset.editingId;
            
            if (editingId) {
                // Update existing job
                const myJobs = JSON.parse(localStorage.getItem('myJobs') || '[]');
                const index = myJobs.findIndex(j => j.id === parseInt(editingId));
                if (index !== -1) {
                    myJobs[index] = {
                        ...myJobs[index],
                        title: document.getElementById('jobTitle').value,
                        category: document.getElementById('jobCategory').value || 'أخرى',
                        desc: document.getElementById('jobDesc').value,
                        district: document.getElementById('jobDistrict').value,
                        priceMin: parseInt(document.getElementById('jobPriceMin').value) || 0,
                        priceMax: parseInt(document.getElementById('jobPriceMax').value) || 0,
                        whatsapp: document.getElementById('jobWhatsapp').value.trim()
                    };
                    localStorage.setItem('myJobs', JSON.stringify(myJobs));
                    enqueueSyncEvent('job.update', myJobs[index]);
                    initData();
                    showToast('✅ تم التعديل!');
                }
                delete modal.dataset.editingId;
            } else {
                // Create new job
                originalSubmitJob(e);
                return;
            }
            
            closeModal('postJob');
            e.target.reset();
            renderProfile();
        };
        
        function showToast(msg) {
            const existing = document.querySelector('.toast');
            if (existing) {
                existing.classList.add('is-hiding');
                setTimeout(() => existing.remove(), 200);
            }
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.textContent = msg;
            document.body.appendChild(toast);
            setTimeout(() => toast.classList.add('is-hiding'), 2500);
            setTimeout(() => toast.remove(), 2800);
        }
        

        // City Selector
const cities = {
    'tangier': { name: 'طنجة', ar: 'طنجة', districts: ['وسط المدينة', 'الباريو', 'العلالي', 'كد يا', 'مرتيل'] },
    'marrakech': { name: 'مراكش', ar: 'مراكش', districts: ['وسط المدينة', ' Gueliz', 'الأوداية', 'الطريق القديمة'] },
    'casablanca': { name: 'الدار البيضاء', ar: 'الدار البيضاء', districts: ['الماركيه', 'الحي الحسني', 'عين السبع'] },
    'rabat': { name: 'الرباط', ar: 'الرباط', districts: ['وسط المدينة', 'ال أكد', 'السوحي'] }
};

let currentCity = 'tangier';

function showCitySelector() {
    const cityNames = Object.values(cities).map(c => `<button class="city-btn" onclick="selectCity('${c.name.toLowerCase()}')">${c.name}</button>`).join('');
    showToast('�Cities: ' + cityNames, 5000);
}

function selectCity(city) {
    currentCity = city;
    document.getElementById('currentCity').textContent = '| ' + cities[city].name;
    initData(); // Reload jobs for city
    renderJobs();
    showToast('تم التحويل إلى ' + cities[city].ar, 2000);
}

// ========== INITIALIZATION ==========
        function init() {
    // Initialize data and render
    initData();
    checkOnboarding();
    renderJobs();
    
    // Update header stats
    setTotalJobsCount(jobs.length);
    document.getElementById('activeJobs').textContent = jobs.length;
    document.getElementById('totalWorkers').textContent = workers.length;
}
document.addEventListener("DOMContentLoaded", init);
