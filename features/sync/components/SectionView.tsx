import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import type { SectionStatus } from "../useSectionStatus";

type SlotProps = {
  children: ReactNode;
};

const Loading = (_props: SlotProps) => null;
const Empty = (_props: SlotProps) => null;
const OfflineEmpty = (_props: SlotProps) => null;
const Ready = (_props: SlotProps) => null;

type SectionViewProps<T> = {
  status: SectionStatus<T>;
  children: ReactNode;
};

function SectionViewRoot<T>({ status, children }: SectionViewProps<T>) {
  let loadingSlot: ReactNode = null;
  let emptySlot: ReactNode = null;
  let offlineEmptySlot: ReactNode = null;
  let readySlot: ReactNode = null;

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const element = child as ReactElement<SlotProps>;
    if (element.type === Loading) loadingSlot = element.props.children;
    else if (element.type === Empty) emptySlot = element.props.children;
    else if (element.type === OfflineEmpty)
      offlineEmptySlot = element.props.children;
    else if (element.type === Ready) readySlot = element.props.children;
  });

  switch (status.phase) {
    case "loading":
      return <>{loadingSlot}</>;
    case "empty":
      return <>{emptySlot}</>;
    case "offline-empty":
      return <>{offlineEmptySlot}</>;
    case "ready":
      return <>{readySlot}</>;
  }
}

export const SectionView = Object.assign(SectionViewRoot, {
  Loading,
  Empty,
  OfflineEmpty,
  Ready,
});

export default SectionView;
