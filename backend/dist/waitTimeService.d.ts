import { Pool } from 'pg';
export interface WalkInQueueEntry {
    queue_id: string;
    customer_name: string;
    customer_phone: string;
    status: 'waiting' | 'ready' | 'called' | 'served' | 'left' | 'no_show';
    position: number;
    estimated_wait_minutes: number;
    estimated_service_duration: number;
    created_at: string;
    updated_at: string;
    served_at?: string;
}
export interface Booking {
    booking_id: string;
    appointment_date: string;
    appointment_time: string;
    slot_duration: number;
    status: string;
}
export interface BarberStatus {
    barber_id: string;
    is_active: boolean;
    current_client_end_time?: string;
}
export interface WaitTimeCalculation {
    currentWaitMinutes: number;
    queueLength: number;
    activeBarbers: number;
    nextAvailableSlot?: string;
}
export declare class WaitTimeService {
    private pool;
    constructor(pool: Pool);
    /**
     * Get the current estimated wait time in minutes
     */
    getCurrentWaitMinutes(): Promise<number>;
    /**
     * Get the queue position for a specific user
     */
    getQueuePositionFor(queueId: string): Promise<number | null>;
    /**
     * Calculate the current wait time based on:
     * - Active barbers
     * - Upcoming appointments
     * - Walk-in queue
     */
    calculateWaitTime(): Promise<WaitTimeCalculation>;
    /**
     * Get the number of active barbers
     * TODO: This should query a barbers table when implemented
     */
    private getActiveBarberCount;
    /**
     * Get upcoming appointments for a specific date starting from a specific time
     */
    private getUpcomingAppointments;
    /**
     * Get the current walk-in queue (waiting customers)
     */
    private getWalkInQueue;
    /**
     * Estimate wait time based on barber availability, appointments, and queue
     */
    private estimateWaitTime;
    /**
     * Calculate the next available time slot
     */
    private calculateNextAvailableSlot;
    /**
     * Update queue positions after a change
     */
    updateQueuePositions(): Promise<void>;
    /**
     * Recalculate wait times for all queue entries
     */
    private recalculateAllWaitTimes;
}
export default WaitTimeService;
//# sourceMappingURL=waitTimeService.d.ts.map