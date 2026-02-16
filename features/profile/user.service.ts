import { db } from "@/powersync/system";

export const getUserDetails = async (userId: number) => {
  return await db.query.accountDetailsTable.findFirst({
    with: {
      userId: {
        columns: {
          email: true,
        },
      },
    },
    where: (accountDetails, { eq }) => eq(accountDetails.userId, userId),
  });
};
