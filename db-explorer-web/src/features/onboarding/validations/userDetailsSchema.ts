import { z } from 'zod';

// Common validation patterns matching backend
const phoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .regex(/^[+]?[\d\s\-\(\)]{10,15}$/, "Invalid phone number format");

// Enum validations matching backend database
const userGenderSchema = z.enum(["male", "female", "other"] as const, {
  message: "Please select your gender",
});

export const userDetailsSchema = z
  .object({
    fullName: z
      .string()
      .min(1, "Full name is required")
      .min(2, "Full name must be at least 2 characters")
      .max(255, "Full name too long")
      .refine((val) => val.trim().length >= 2, {
        message: "Full name must contain at least 2 non-whitespace characters",
      }),
    phoneNumber: phoneSchema,
    gender: userGenderSchema,
    dob: z
      .string()
      .min(1, "Date of birth is required")
      .refine(
        (val) => {
          if (!val) return false;
          // Check if it's a valid date format (YYYY-MM-DD)
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(val)) return false;
          
          // Check if it's a valid date
          const date = new Date(val);
          return !isNaN(date.getTime());
        },
        {
          message: "Invalid date format (YYYY-MM-DD required)",
        }
      )
      .refine(
        (val) => {
          if (!val) return false;
          
          const dobDate = new Date(val);
          const today = new Date();
          const age = today.getFullYear() - dobDate.getFullYear();
          const monthDiff = today.getMonth() - dobDate.getMonth();
          
          // Adjust age if birthday hasn't occurred this year
          const adjustedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate()) 
            ? age - 1 
            : age;
            
          return adjustedAge >= 18 && adjustedAge <= 100;
        },
        {
          message: "User must be between 18 and 100 years old",
        }
      ),
    bio: z
      .string()
      .max(500, "Bio must be less than 500 characters")
      .optional()
      .or(z.literal("")),
  });

export type UserDetailsFormData = z.infer<typeof userDetailsSchema>;

// Helper function to get gender display text
export const getGenderDisplayText = (gender: string) => {
  switch (gender) {
    case "male":
      return "Male";
    case "female":
      return "Female";
    case "other":
      return "Other";
    default:
      return gender;
  }
};