/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ["class"],
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			},
			colors: {
				master: {
					'bg-primary': '#2A0A0A',
					'bg-mid': '#3D0F0F',
					'bg-end': '#5C1B1B',
					'panel': '#2D0808',
					'panel-dark': '#1A0505',
					'panel-hover': '#3D0F0F',
					'red': '#DC2626',
					'red-dark': '#991B1B',
					'orange': '#EA580C',
					'gold': '#F59E0B',
					'gold-light': '#FCD34D',
					// Text color tokens - High contrast, accessible
					'text-primary-dark': '#F5E9E4',      // Warm off-white for dark backgrounds
					'text-primary-light': '#301010',     // Dark maroon for light backgrounds
					'text-secondary-dark': '#D5BEB3',    // Softer warm neutral for dark backgrounds
					'text-secondary-light': '#6A3A2E',   // Warm brown for light backgrounds
					'text-muted-dark': '#B28C7A',        // Muted warm for dark backgrounds
					'text-muted-light': '#8A5A4A',       // Muted warm brown for light backgrounds
				},
			},
			keyframes: {
				"accordion-down": {
					from: {
						height: "0",
					},
					to: {
						height: "var(--radix-accordion-content-height)",
					},
				},
				"accordion-up": {
					from: {
						height: "var(--radix-accordion-content-height)",
					},
					to: {
						height: "0",
					},
				},
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
};
