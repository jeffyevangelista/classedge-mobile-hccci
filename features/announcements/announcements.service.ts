import { db } from "@/powersync/system";

export const getAnnouncementsWithEvents = () => {
  return db.query.announcementsTable.findMany({
    orderBy: (announcements, { desc }) => desc(announcements.createdAt),
    with: {
      createdById: {
        columns: {
          firstName: true,
          lastName: true,
          studentPhoto: true,
        },
      },
      events: {
        with: {
          event: {
            with: {
              createdById: {
                columns: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
    },
  });
};

export const getAnnouncement = (announcementId: number) => {
  return db.query.announcementsTable.findFirst({
    where: (announcements, { eq }) => eq(announcements.id, announcementId),
    with: {
      createdById: {
        columns: { firstName: true, lastName: true, studentPhoto: true },
      },
      events: {
        with: {
          event: {
            with: {
              createdById: { columns: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });
};
