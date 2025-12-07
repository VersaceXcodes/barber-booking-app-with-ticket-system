-- Migration: Add barber_id column to walk_in_queue table
-- This migration adds the barber_id column if it doesn't exist

-- Add barber_id column with nullable constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'walk_in_queue' 
        AND column_name = 'barber_id'
    ) THEN
        ALTER TABLE walk_in_queue 
        ADD COLUMN barber_id TEXT NULL;
        
        RAISE NOTICE 'Successfully added barber_id column to walk_in_queue table';
    ELSE
        RAISE NOTICE 'barber_id column already exists in walk_in_queue table';
    END IF;
END $$;

-- Add foreign key constraint if barbers table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'barbers'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_walk_in_queue_barber'
        AND table_name = 'walk_in_queue'
    ) THEN
        ALTER TABLE walk_in_queue
        ADD CONSTRAINT fk_walk_in_queue_barber
        FOREIGN KEY (barber_id) 
        REFERENCES barbers(barber_id) 
        ON DELETE SET NULL;
        
        RAISE NOTICE 'Successfully added foreign key constraint';
    END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_walk_in_queue_barber_id 
ON walk_in_queue(barber_id);
