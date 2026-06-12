import { useEffect, useState } from "react";
import { View } from "react-native";
import { Spinner, useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { UploadEmpty } from "./UploadEmpty";
import { UploadFilled } from "./UploadFilled";
import { SourcePickerSheet, type UploadSource } from "./SourcePickerSheet";
import { getFileMeta, type FileMeta } from "./fileMeta";

interface Props {
  uri?: string | null;
  disabled?: boolean;
  picking?: boolean;
  errorMessage?: string | null;
  onPickSource: (source: UploadSource) => void;
  onRemove: () => void;
}

export const UploadCard = ({
  uri,
  disabled,
  picking,
  errorMessage,
  onPickSource,
  onRemove,
}: Props) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [meta, setMeta] = useState<FileMeta | null>(null);
  const dangerColor = useThemeColor("danger");

  useEffect(() => {
    let cancelled = false;
    if (uri) {
      getFileMeta(uri).then((m) => {
        if (!cancelled) setMeta(m);
      });
    } else {
      setMeta(null);
    }
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const openSheet = () => setSheetOpen(true);
  const hasError = !!errorMessage && !uri;

  return (
    <View>
      <View>
        {uri && meta ? (
          <UploadFilled
            uri={uri}
            meta={meta}
            onReplace={openSheet}
            onRemove={onRemove}
            disabled={disabled}
          />
        ) : (
          <UploadEmpty
            onAdd={openSheet}
            disabled={disabled}
            hasError={hasError}
          />
        )}
        {picking ? (
          // Translucent surface overlay matches the underlying card's
          // rounded-xl radius so the loader sits inside the same shape.
          <View
            pointerEvents="none"
            className="absolute inset-0 items-center justify-center bg-surface/70 rounded-xl"
          >
            <Spinner size="sm" />
          </View>
        ) : null}
      </View>

      {errorMessage ? (
        <View className="flex-row items-center gap-1.5 mt-2">
          <Icon name="WarningCircleIcon" size={12} color={dangerColor} />
          <AppText weight="semibold" className="text-xs text-danger">
            {errorMessage}
          </AppText>
        </View>
      ) : null}

      <SourcePickerSheet
        isOpen={sheetOpen}
        onOpenChange={setSheetOpen}
        onPick={onPickSource}
      />
    </View>
  );
};
