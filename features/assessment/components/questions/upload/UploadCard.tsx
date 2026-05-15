import { useEffect, useState } from "react";
import { View } from "react-native";
import { Spinner } from "heroui-native";
import { AppText } from "@/components/AppText";
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
          <UploadEmpty onAdd={openSheet} disabled={disabled} />
        )}
        {picking ? (
          <View
            pointerEvents="none"
            className="absolute inset-0 items-center justify-center bg-background/60 rounded-lg"
          >
            <Spinner size="sm" />
          </View>
        ) : null}
      </View>

      {errorMessage ? (
        <AppText className="text-xs text-danger mt-2">{errorMessage}</AppText>
      ) : null}

      <SourcePickerSheet
        isOpen={sheetOpen}
        onOpenChange={setSheetOpen}
        onPick={onPickSource}
      />
    </View>
  );
};
