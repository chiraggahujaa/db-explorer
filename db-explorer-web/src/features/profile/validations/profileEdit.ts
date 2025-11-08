import { z } from "zod";

// Common validation patterns
const phoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .regex(/^[+]?[\d\s\-\(\)]{10,15}$/, "Invalid phone number format");

// Enum validations matching backend database
const userGenderSchema = z.enum(["male", "female", "other", "prefer_not_to_say"] as const);

// Profile edit validation schema
export const profileEditSchema = z
  .object({
    fullName: z
      .string()
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

// Export the type for use in components
export type ProfileEditFormData = z.infer<typeof profileEditSchema>;

// Helper function to validate individual fields (useful for real-time validation)
export const validateField = (fieldName: keyof ProfileEditFormData, value: unknown) => {
  try {
    const fieldSchema = profileEditSchema.shape[fieldName];
    fieldSchema.parse(value);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || "Invalid value" };
    }
    return { success: false, error: "Validation failed" };
  }
};