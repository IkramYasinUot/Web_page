// Initialize Supabase Client
// REPLACE THESE WITH YOUR ACTUAL SUPABASE PROJECT URL AND ANON KEY
const SUPABASE_URL = 'https://rurdkwnoovxteonejukw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cmRrd25vb3Z4dGVvbmVqdWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNDA1NTUsImV4cCI6MjA3OTkxNjU1NX0.PBWEwhtZdO4Tqe1TwdFppyDuXCdVwHvIyerOuUjDzLw';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

class CarMarketplace {
    constructor() {
        this.currentUser = null;
        this.selectedPhotos = [];
        this.init();
    }

    async init() {
        await this.checkAuthState();
        this.setupEventListeners();
        this.loadCars();
        console.log('AutoMarket initialized with Supabase');
    }

    // Photo Upload Methods
    setupPhotoUpload() {
        const uploadArea = document.getElementById('photoUploadArea');
        const fileInput = document.getElementById('carPhotos');
        const preview = document.getElementById('photoPreview');

        if (!uploadArea || !fileInput) return;

        // Click to upload
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            this.handleFileSelect(e.dataTransfer.files);
        });
    }

    handleFileSelect(files) {
        const maxFiles = 5;
        const maxSize = 300 * 1024; // 300KB (Reduced to prevent database errors)

        // Check file count
        if (this.selectedPhotos.length + files.length > maxFiles) {
            this.showNotification(`You can only upload up to ${maxFiles} photos`, 'error');
            return;
        }

        for (let file of files) {
            // Check file type
            if (!file.type.startsWith('image/')) {
                this.showNotification('Please upload only image files', 'error');
                continue;
            }

            // Check file size
            if (file.size > maxSize) {
                this.showNotification(`File ${file.name} is too large. Max size is 300KB`, 'error');
                continue;
            }

            this.processImageFile(file);
        }
    }

    processImageFile(file) {
        const reader = new FileReader();

        reader.onload = (e) => {
            const photoData = {
                id: Date.now() + Math.random(),
                name: file.name,
                dataUrl: e.target.result,
                file: file
            };

            this.selectedPhotos.push(photoData);
            this.updatePhotoPreview();
        };

        reader.onerror = () => {
            this.showNotification('Error reading file', 'error');
        };

        reader.readAsDataURL(file);
    }

    updatePhotoPreview() {
        const preview = document.getElementById('photoPreview');
        if (!preview) return;

        if (this.selectedPhotos.length === 0) {
            preview.innerHTML = `
                <div class="photo-preview-empty">
                    <i class="fas fa-images"></i>
                    <p>No photos selected</p>
                </div>
            `;
            return;
        }

        preview.innerHTML = this.selectedPhotos.map(photo => `
            <div class="photo-preview-item">
                <img src="${photo.dataUrl}" alt="${photo.name}">
                <button type="button" class="photo-preview-remove" data-photo-id="${photo.id}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        // Add remove event listeners
        preview.querySelectorAll('.photo-preview-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const photoId = e.target.closest('.photo-preview-remove').dataset.photoId;
                this.removePhoto(photoId);
            });
        });
    }

    removePhoto(photoId) {
        this.selectedPhotos = this.selectedPhotos.filter(photo => photo.id != photoId);
        this.updatePhotoPreview();
    }

    clearPhotos() {
        this.selectedPhotos = [];
        this.updatePhotoPreview();
        document.getElementById('carPhotos').value = '';
    }

    // Authentication Methods
    async register(userData) {
        try {
            console.log('Attempting to register:', userData.email);
            const { data, error } = await supabase.auth.signUp({
                email: userData.email,
                password: userData.password,
                options: {
                    data: {
                        name: userData.name,
                        phone: userData.phone
                    }
                }
            });

            if (error) {
                console.error('Supabase registration error:', error);
                throw error;
            }

            console.log('Registration successful:', data);

            // Check if we are automatically logged in (Email Confirmation is OFF)
            if (data.session) {
                this.currentUser = data.user;
                this.showNotification('Registration successful! You are now logged in.', 'success');
                this.updateUI();
            } else {
                // Email Confirmation is ON
                this.showNotification('Registration successful! Please check your email to verify.', 'success');
                alert('Registration successful! Please check your email to verify.');
            }

            return data;
        } catch (error) {
            console.error('Registration exception:', error);
            throw error.message || error.error_description || error;
        }
    }

    async login(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

            this.currentUser = data.user;
            this.showNotification('Login successful!', 'success');
            this.updateUI();
            return data.user;
        } catch (error) {
            throw error.message;
        }
    }

    async logout() {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;

            this.currentUser = null;
            this.showNotification('Logged out successfully', 'success');
            this.updateUI();
            this.showSection('homeSection');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async checkAuthState() {
        const { data: { session } } = await supabase.auth.getSession();
        this.currentUser = session ? session.user : null;
        this.updateUI();

        supabase.auth.onAuthStateChange((event, session) => {
            this.currentUser = session ? session.user : null;
            this.updateUI();
        });
    }

    // Car Methods
    async addCar(carData) {
        try {
            console.log('addCar called. Current User:', this.currentUser);

            if (!this.currentUser) {
                throw new Error('You must be logged in to sell a car');
            }

            // Safety check for user metadata
            const metadata = this.currentUser.user_metadata || {};
            const email = this.currentUser.email;

            if (!email) {
                console.error('User object missing email:', this.currentUser);
                throw new Error('User email not found. Please try logging out and logging back in.');
            }

            const carWithSeller = {
                ...carData,
                seller_id: this.currentUser.id,
                seller_email: email,
                seller_name: metadata.name || 'Anonymous',
                seller_phone: metadata.phone || 'N/A',
                photos: this.selectedPhotos.map(photo => photo.dataUrl)
            };

            console.log('Sending car data to Supabase:', carWithSeller);

            const { data, error } = await supabase
                .from('cars')
                .insert([carWithSeller])
                .select();

            if (error) {
                console.error('Supabase insert error details:', error);
                throw error;
            }

            this.showNotification('Car listed successfully with photos!', 'success');
            this.clearPhotos();
            return data;
        } catch (error) {
            console.error('addCar exception:', error);
            throw error.message || 'Failed to add car';
        }
    }

    async getCars(filters = {}) {
        try {
            let query = supabase.from('cars').select('*');

            if (filters.search) {
                query = query.or(`brand.ilike.%${filters.search}%,model.ilike.%${filters.search}%`);
            }

            if (filters.brand) {
                query = query.eq('brand', filters.brand);
            }

            if (filters.price) {
                switch (filters.price) {
                    case '0-5000': query = query.lte('price', 5000); break;
                    case '5000-15000': query = query.gt('price', 5000).lte('price', 15000); break;
                    case '15000-30000': query = query.gt('price', 15000).lte('price', 30000); break;
                    case '30000-50000': query = query.gt('price', 30000).lte('price', 50000); break;
                    case '50000-100000': query = query.gt('price', 50000).lte('price', 100000); break;
                    case '100000+': query = query.gt('price', 100000); break;
                }
            }

            if (filters.year) {
                switch (filters.year) {
                    case '2020-2024': query = query.gte('year', 2020).lte('year', 2024); break;
                    case '2015-2019': query = query.gte('year', 2015).lte('year', 2019); break;
                    case '2010-2014': query = query.gte('year', 2010).lte('year', 2014); break;
                    case '2005-2009': query = query.gte('year', 2005).lte('year', 2009); break;
                    case '2000-2004': query = query.gte('year', 2000).lte('year', 2004); break;
                    case '1990-1999': query = query.gte('year', 1990).lte('year', 1999); break;
                }
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching cars:', error);
            throw error.message;
        }
    }

    async getUserCars() {
        if (!this.currentUser) return [];

        try {
            const { data, error } = await supabase
                .from('cars')
                .select('*')
                .eq('seller_id', this.currentUser.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching user cars:', error);
            return [];
        }
    }

    async deleteCar(carId) {
        try {
            const { error } = await supabase
                .from('cars')
                .delete()
                .eq('id', carId);

            if (error) throw error;
            this.showNotification('Car listing deleted', 'success');
        } catch (error) {
            throw error.message || 'Failed to delete car';
        }
    }

    // UI Methods
    updateUI() {
        const loginLink = document.getElementById('loginLink');
        const registerLink = document.getElementById('registerLink');
        const logoutLink = document.getElementById('logoutLink');
        const profileLink = document.getElementById('profileLink');
        const sellForm = document.getElementById('sellCarForm');
        const sellLoginPrompt = document.getElementById('sellLoginPrompt');

        if (this.currentUser) {
            loginLink.style.display = 'none';
            registerLink.style.display = 'none';
            logoutLink.style.display = 'block';
            profileLink.style.display = 'block';

            if (sellForm) sellForm.style.display = 'block';
            if (sellLoginPrompt) sellLoginPrompt.style.display = 'none';

            const name = this.currentUser.user_metadata?.name || 'User';
            profileLink.innerHTML = `<i class="fas fa-user"></i> ${name.split(' ')[0]}`;
        } else {
            loginLink.style.display = 'block';
            registerLink.style.display = 'block';
            logoutLink.style.display = 'none';
            profileLink.style.display = 'none';

            if (sellForm) sellForm.style.display = 'none';
            if (sellLoginPrompt) sellLoginPrompt.style.display = 'block';
        }
    }

    showSection(sectionId) {
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });

        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        const activeLink = document.getElementById(sectionId.replace('Section', 'Link'));
        if (activeLink) {
            activeLink.classList.add('active');
        }

        if (sectionId === 'browseSection') {
            this.loadCars();
        } else if (sectionId === 'profileSection' && this.currentUser) {
            this.loadUserProfile();
        } else if (sectionId === 'sellSection') {
            this.updateUI();
            this.setupPhotoUpload();
        }
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.textContent = message;
            notification.className = `notification ${type} show`;

            setTimeout(() => {
                notification.classList.remove('show');
            }, 4000);
        }
    }

    // Event Handlers Setup
    setupEventListeners() {
        // Navigation
        document.getElementById('homeLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showSection('homeSection');
        });

        document.getElementById('browseLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showSection('browseSection');
        });

        document.getElementById('sellLink').addEventListener('click', (e) => {
            e.preventDefault();
            if (this.currentUser) {
                this.showSection('sellSection');
            } else {
                this.showModal('loginModal');
                this.showNotification('Please login to sell your car', 'error');
            }
        });

        document.getElementById('profileLink').addEventListener('click', (e) => {
            e.preventDefault();
            if (this.currentUser) {
                this.showSection('profileSection');
            } else {
                this.showModal('loginModal');
            }
        });

        document.getElementById('loginLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showModal('loginModal');
        });

        document.getElementById('registerLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showModal('registerModal');
        });

        document.getElementById('logoutLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        // Hero buttons
        document.getElementById('heroBrowse').addEventListener('click', () => {
            this.showSection('browseSection');
        });

        document.getElementById('heroSell').addEventListener('click', () => {
            if (this.currentUser) {
                this.showSection('sellSection');
            } else {
                this.showModal('loginModal');
                this.showNotification('Please login to sell your car', 'error');
            }
        });

        // Modal close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modalId = e.target.getAttribute('data-modal');
                this.hideModal(modalId);
            });
        });

        // Modal background close
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideModal(e.target.id);
            }
        });

        // Forms
        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('sellCarForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSellCar();
        });

        // Show register modal link
        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            this.hideModal('loginModal');
            this.showModal('registerModal');
        });

        // Login prompt buttons
        document.getElementById('promptLogin')?.addEventListener('click', () => {
            this.showModal('loginModal');
        });

        document.getElementById('promptRegister')?.addEventListener('click', () => {
            this.showModal('registerModal');
        });

        // Search and filters
        document.getElementById('applyFilters').addEventListener('click', () => {
            this.loadCars();
        });

        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearFilters();
        });

        document.getElementById('searchInput').addEventListener('input', () => {
            this.loadCars();
        });

        document.getElementById('brandFilter').addEventListener('change', () => {
            this.loadCars();
        });

        document.getElementById('priceFilter').addEventListener('change', () => {
            this.loadCars();
        });

        document.getElementById('yearFilter').addEventListener('change', () => {
            this.loadCars();
        });

        // Mobile menu
        document.getElementById('navToggle').addEventListener('click', () => {
            document.getElementById('navLinks').classList.toggle('active');
        });

        // Setup photo upload when page loads
        this.setupPhotoUpload();
    }

    clearFilters() {
        document.getElementById('searchInput').value = '';
        document.getElementById('brandFilter').value = '';
        document.getElementById('priceFilter').value = '';
        document.getElementById('yearFilter').value = '';
        this.loadCars();
    }

    // Form Handlers
    async handleRegister() {
        const formData = {
            name: document.getElementById('registerName').value.trim(),
            email: document.getElementById('registerEmail').value.trim().toLowerCase(),
            phone: document.getElementById('registerPhone').value.trim(),
            password: document.getElementById('registerPassword').value
        };

        const confirmPassword = document.getElementById('registerConfirmPassword').value;

        console.log('Register form data:', formData);

        if (!formData.name || !formData.email || !formData.phone || !formData.password) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        if (formData.password !== confirmPassword) {
            this.showNotification('Passwords do not match', 'error');
            return;
        }

        if (formData.password.length < 6) {
            this.showNotification('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            const result = await this.register(formData);
            this.hideModal('registerModal');
            document.getElementById('registerForm').reset();

            // If we have a session (auto-login), go to home. Otherwise show login modal.
            if (result.session) {
                this.showSection('homeSection');
            } else {
                setTimeout(() => {
                    this.showModal('loginModal');
                }, 1000);
            }
        } catch (error) {
            console.error('Handle register error:', error);
            this.showNotification(error, 'error');
            alert('Registration failed: ' + error);
        }
    }

    async handleLogin() {
        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        try {
            await this.login(email, password);
            this.hideModal('loginModal');
            document.getElementById('loginForm').reset();
            this.showSection('homeSection');
        } catch (error) {
            this.showNotification(error, 'error');
        }
    }

    async handleSellCar() {
        if (!this.currentUser) {
            this.showNotification('Please login first', 'error');
            return;
        }

        const formData = {
            brand: document.getElementById('carBrand').value,
            model: document.getElementById('carModel').value.trim(),
            year: parseInt(document.getElementById('carYear').value),
            price: parseFloat(document.getElementById('carPrice').value),
            mileage: document.getElementById('carMileage').value ? parseInt(document.getElementById('carMileage').value) : null,
            fuel: document.getElementById('carFuel').value,
            description: document.getElementById('carDescription').value.trim(),
            contact: document.getElementById('carContact').value.trim()
        };

        if (!formData.brand || !formData.model || !formData.year || !formData.price || !formData.description || !formData.contact) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        if (formData.year < 1990 || formData.year > 2024) {
            this.showNotification('Please enter a valid year between 1990 and 2024', 'error');
            return;
        }

        if (formData.price <= 0) {
            this.showNotification('Please enter a valid price', 'error');
            return;
        }

        try {
            await this.addCar(formData);
            document.getElementById('sellCarForm').reset();
            this.showSection('browseSection');
        } catch (error) {
            this.showNotification(error, 'error');
        }
    }

    // Data Loading Methods
    async loadCars() {
        const searchTerm = document.getElementById('searchInput').value;
        const brandFilter = document.getElementById('brandFilter').value;
        const priceFilter = document.getElementById('priceFilter').value;
        const yearFilter = document.getElementById('yearFilter').value;

        const filters = {
            search: searchTerm,
            brand: brandFilter,
            price: priceFilter,
            year: yearFilter
        };

        try {
            const cars = await this.getCars(filters);
            this.displayCars(cars);

            const resultsCount = document.getElementById('resultsCount');
            if (cars.length === 0) {
                resultsCount.textContent = 'No cars found matching your criteria';
            } else {
                resultsCount.textContent = `Found ${cars.length} car${cars.length === 1 ? '' : 's'}`;
                if (searchTerm || brandFilter || priceFilter || yearFilter) {
                    resultsCount.textContent += ' matching your search';
                }
            }
        } catch (error) {
            this.showNotification('Error loading cars', 'error');
        }
    }

    displayCars(cars) {
        const carsList = document.getElementById('carsList');

        if (cars.length === 0) {
            carsList.innerHTML = `
                <div class="no-cars" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                    <i class="fas fa-car" style="font-size: 3rem; color: #64748b; margin-bottom: 1rem;"></i>
                    <h3>No cars found</h3>
                    <p>Try adjusting your search criteria or clear filters</p>
                    <button class="btn btn-primary" onclick="carMarketplace.clearFilters()">Clear Filters</button>
                </div>
            `;
            return;
        }

        carsList.innerHTML = cars.map(car => `
            <div class="car-card" data-car-id="${car.id}">
                <div class="car-image">
                    ${car.photos && car.photos.length > 0 ?
                `<img src="${car.photos[0]}" alt="${car.brand} ${car.model}">` :
                `<div class="car-image-placeholder"><i class="fas fa-car"></i></div>`
            }
                </div>
                <div class="car-details">
                    <h3 class="car-title">${car.brand} ${car.model}</h3>
                    <div class="car-price">$${car.price.toLocaleString()}</div>
                    <div class="car-info">
                        <div><i class="fas fa-calendar"></i> Year: ${car.year}</div>
                        ${car.mileage ? `<div><i class="fas fa-tachometer-alt"></i> Mileage: ${car.mileage.toLocaleString()} miles</div>` : ''}
                        <div><i class="fas fa-gas-pump"></i> Fuel: ${car.fuel}</div>
                    </div>
                    <div class="car-actions">
                        <button class="btn btn-primary view-car" data-car-id="${car.id}">
                            <i class="fas fa-eye"></i> View Details
                        </button>
                        ${this.currentUser && this.currentUser.id === car.seller_id ?
                `<button class="btn btn-danger delete-car" data-car-id="${car.id}">
                                <i class="fas fa-trash"></i> Delete
                            </button>` : ''
            }
                    </div>
                </div>
            </div>
        `).join('');

        // Add event listeners
        carsList.querySelectorAll('.view-car').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const carId = parseInt(e.target.closest('.view-car').dataset.carId);
                this.showCarDetail(carId);
            });
        });

        carsList.querySelectorAll('.delete-car').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const carId = parseInt(e.target.closest('.delete-car').dataset.carId);
                if (confirm('Are you sure you want to delete this car listing?')) {
                    try {
                        await this.deleteCar(carId);
                        this.loadCars();
                        if (document.getElementById('profileSection').classList.contains('active')) {
                            this.loadUserProfile();
                        }
                    } catch (error) {
                        this.showNotification('Error deleting car', 'error');
                    }
                }
            });
        });
    }

    async showCarDetail(carId) {
        try {
            const cars = await this.getCars();
            const car = cars.find(c => c.id === carId);

            if (!car) {
                this.showNotification('Car not found', 'error');
                return;
            }

            const photos = car.photos || [];
            const modalContent = document.getElementById('carDetailContent');

            modalContent.innerHTML = `
                <div class="car-detail">
                    <div class="car-gallery">
                        <div class="car-gallery-main">
                            ${photos.length > 0 ?
                    `<img src="${photos[0]}" alt="${car.brand} ${car.model}">` :
                    `<div style="width: 100%; height: 100%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #64748b;">
                                    <i class="fas fa-car" style="font-size: 4rem;"></i>
                                </div>`
                }
                        </div>
                        ${photos.length > 1 ? `
                        <div class="car-gallery-thumbnails">
                            ${photos.map((photo, index) => `
                                <div class="car-gallery-thumbnail ${index === 0 ? 'active' : ''}" data-photo-index="${index}">
                                    <img src="${photo}" alt="${car.brand} ${car.model} - Photo ${index + 1}">
                                </div>
                            `).join('')}
                        </div>
                        ` : ''}
                    </div>
                    <div class="car-detail-info">
                        <h2>${car.brand} ${car.model}</h2>
                        <div class="car-detail-price">$${car.price.toLocaleString()}</div>
                        
                        <div class="car-detail-specs">
                            <div class="spec-item">
                                <span><i class="fas fa-calendar"></i> Year:</span>
                                <span>${car.year}</span>
                            </div>
                            ${car.mileage ? `
                            <div class="spec-item">
                                <span><i class="fas fa-tachometer-alt"></i> Mileage:</span>
                                <span>${car.mileage.toLocaleString()} miles</span>
                            </div>` : ''}
                            <div class="spec-item">
                                <span><i class="fas fa-gas-pump"></i> Fuel Type:</span>
                                <span>${car.fuel}</span>
                            </div>
                            <div class="spec-item">
                                <span><i class="fas fa-user"></i> Seller:</span>
                                <span>${car.seller_name || car.sellerName}</span>
                            </div>
                            <div class="spec-item">
                                <span><i class="fas fa-images"></i> Photos:</span>
                                <span>${photos.length}</span>
                            </div>
                            <div class="spec-item">
                                <span><i class="fas fa-clock"></i> Listed:</span>
                                <span>${new Date(car.created_at || car.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <div class="car-detail-description">
                            <h3>Description</h3>
                            <p>${car.description}</p>
                        </div>

                        <div class="car-detail-contact">
                            <h3><i class="fas fa-phone"></i> Contact Seller</h3>
                            <p><strong>Name:</strong> ${car.seller_name || car.sellerName}</p>
                            <p><strong>Phone:</strong> ${car.contact || car.seller_phone || car.sellerPhone}</p>
                            <p><strong>Email:</strong> ${car.seller_email || car.sellerEmail}</p>
                        </div>
                    </div>
                </div>
            `;

            // Add thumbnail click listeners
            if (photos.length > 1) {
                modalContent.querySelectorAll('.car-gallery-thumbnail').forEach(thumb => {
                    thumb.addEventListener('click', () => {
                        const photoIndex = parseInt(thumb.dataset.photoIndex);
                        const mainImage = modalContent.querySelector('.car-gallery-main img');
                        if (mainImage) {
                            mainImage.src = photos[photoIndex];
                        }
                        // Update active thumbnail
                        modalContent.querySelectorAll('.car-gallery-thumbnail').forEach(t => t.classList.remove('active'));
                        thumb.classList.add('active');
                    });
                });
            }

            this.showModal('carDetailModal');
        } catch (error) {
            this.showNotification('Error loading car details', 'error');
        }
    }

    async loadUserProfile() {
        if (!this.currentUser) return;

        const name = this.currentUser.user_metadata?.name || 'User';
        const phone = this.currentUser.user_metadata?.phone || 'N/A';
        const email = this.currentUser.email;

        // Display user info
        const userInfo = document.getElementById('userInfo');
        userInfo.innerHTML = `
            <div class="user-details">
                <p><strong><i class="fas fa-user"></i> Name:</strong> ${name}</p>
                <p><strong><i class="fas fa-envelope"></i> Email:</strong> ${email}</p>
                <p><strong><i class="fas fa-phone"></i> Phone:</strong> ${phone}</p>
                <p><strong><i class="fas fa-calendar"></i> Member since:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
        `;

        // Display user's cars
        try {
            const userCars = await this.getUserCars();
            const myCarsList = document.getElementById('myCarsList');

            if (userCars.length === 0) {
                myCarsList.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: #64748b;">
                        <i class="fas fa-car" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                        <p>You haven't listed any cars yet.</p>
                        <button class="btn btn-primary" onclick="carMarketplace.showSection('sellSection')">
                            List Your First Car
                        </button>
                    </div>
                `;
                return;
            }

            myCarsList.innerHTML = `
                <div class="my-cars-grid">
                    ${userCars.map(car => `
                        <div class="my-car-item">
                            <div class="my-car-info">
                                <strong>${car.brand} ${car.model} (${car.year})</strong>
                                <div>Price: $${car.price.toLocaleString()}</div>
                                <div>${car.mileage ? `Mileage: ${car.mileage.toLocaleString()} miles` : 'Mileage: Not specified'}</div>
                                <div>Photos: ${car.photos ? car.photos.length : 0}</div>
                                <small>Listed: ${new Date(car.created_at || car.createdAt).toLocaleDateString()}</small>
                            </div>
                            <div class="my-car-actions">
                                <button class="btn btn-primary view-car" data-car-id="${car.id}">
                                    <i class="fas fa-eye"></i> View
                                </button>
                                <button class="btn btn-danger delete-car" data-car-id="${car.id}">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            // Add event listeners
            myCarsList.querySelectorAll('.view-car').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const carId = parseInt(e.target.closest('.view-car').dataset.carId);
                    this.showCarDetail(carId);
                });
            });

            myCarsList.querySelectorAll('.delete-car').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const carId = parseInt(e.target.closest('.delete-car').dataset.carId);
                    if (confirm('Are you sure you want to delete this car listing?')) {
                        try {
                            await this.deleteCar(carId);
                            this.loadUserProfile();
                            this.loadCars();
                        } catch (error) {
                            this.showNotification('Error deleting car', 'error');
                        }
                    }
                });
            });

        } catch (error) {
            this.showNotification('Error loading your cars', 'error');
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.carMarketplace = new CarMarketplace();
});