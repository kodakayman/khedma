-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL CHECK (role IN ('worker', 'client')),
  skills JSONB,
  district TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workers table (for worker profiles)
CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  skill TEXT NOT NULL,
  rating FLOAT DEFAULT 0,
  jobs_count INT DEFAULT 0,
  phone TEXT UNIQUE NOT NULL,
  district TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  district TEXT NOT NULL,
  category TEXT NOT NULL,
  price_min INT,
  price_max INT,
  views INT DEFAULT 0,
  applicants INT DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed')),
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  client_id UUID REFERENCES users(id)
);

-- Applications table
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved Jobs table
CREATE TABLE IF NOT EXISTS saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- Job Alerts table
CREATE TABLE IF NOT EXISTS job_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category TEXT,
  district TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for now - tighten as needed)
CREATE POLICY "Allow all access to users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to workers" ON workers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to jobs" ON jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to applications" ON applications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to saved_jobs" ON saved_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to job_alerts" ON job_alerts FOR ALL USING (true) WITH CHECK (true);

-- Insert sample workers
INSERT INTO workers (name, skill, rating, jobs_count, phone, district, verified) VALUES
('عبد الكريم', 'تنظيف', 4.9, 234, '+212661234567', 'الباريو', true),
('سعيد', 'نقل', 4.8, 189, '+212671234567', 'وسط المدينة', true),
('يونس', 'سباكة', 4.7, 145, '+212681234567', 'العلالي', false),
('حكيم', 'كهرباء', 4.9, 98, '+212691234567', 'كد يا', true),
('رشيد', 'دهان', 4.8, 167, '+212661334567', 'مرتيل', false),
('أمين', 'نجارة', 4.6, 76, '+212671334567', 'الميناء', false),
('عمر', 'تبريد', 4.7, 112, '+212681334567', 'الوازيس', true);

-- Insert sample jobs
INSERT INTO jobs (title, description, district, category, price_min, price_max, views, applicants) VALUES
('🧹 تنظيف شقة', 'تنظيف شقة كبيرة 3 غرف', 'الباريو', 'تنظيف', 300, 500, 156, 8),
('🚚 نقل أثاث', 'نقل أثاث من حي لآخر', 'وسط المدينة', 'نقل', 400, 800, 89, 5),
('🔧 إصلاح水管', 'تسرب مياه في المطبخ', 'العلالي', 'سباكة', 200, 400, 234, 12),
('⚡ تركيب ثلاجة', 'تركيب ثلاجة جديدة', 'كد يا', 'كهرباء', 300, 450, 56, 3),
('🎨 دهان غرفة', 'دهان غرفة نوم', 'وسط المدينة', 'دهان', 400, 600, 34, 2);
