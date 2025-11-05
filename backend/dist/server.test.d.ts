export declare const createTestUser: (overrides?: {}) => Promise<{
    user: any;
    password: string;
}>;
export declare const loginUser: (email: string, password: string) => Promise<any>;
export declare const createTestBooking: (overrides?: {}) => Promise<any>;
export declare const createTestService: (token: string, overrides?: {}) => Promise<any>;
//# sourceMappingURL=server.test.d.ts.map