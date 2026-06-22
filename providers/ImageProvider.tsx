import { Zoomable } from "@likashefqet/react-native-image-zoom";
import { Image } from "expo-image";
import {
  createContext,
  forwardRef,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "@/components/Icon";

// Types
interface ImageContextType {
  showImage: (imageUri: string) => void;
}

interface ImageProviderProps {
  children: ReactNode;
}

interface ImageViewRef {
  show: (uri?: string) => void;
  hide: () => void;
}

const ImageContext = createContext<ImageContextType | null>(null);

export default function ImageProvider({ children }: ImageProviderProps) {
  const imageRef = useRef<ImageViewRef>(null);

  const showImage = (imageUri: string) => {
    imageRef.current?.show(imageUri);
  };

  return (
    <ImageContext.Provider value={{ showImage }}>
      {children}
      <ImageView ref={imageRef} />
    </ImageContext.Provider>
  );
}

const ImageView = forwardRef<ImageViewRef>((_props, ref) => {
  const [show, setShow] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imageUriRef = useRef("");

  const hide = useCallback(() => {
    imageUriRef.current = "";
    setShow(false);
    setLoaded(false);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      hide,
      show: (uri: string = "") => {
        imageUriRef.current = uri;
        setLoaded(false);
        setShow(true);
      },
    }),
    [hide],
  );

  // The overlay is a plain View (not a Modal), so we have to intercept the
  // Android hardware back button manually — otherwise back press falls
  // through to the navigator and the image overlay just sits on top.
  useEffect(() => {
    if (!show) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        hide();
        return true;
      },
    );
    return () => subscription.remove();
  }, [show, hide]);

  if (!show) return null;

  return (
    <View style={styles.overlayContainer}>
      <View style={styles.overlayBackground} />
      <View style={styles.overlayContent}>
        <TouchableOpacity style={styles.closeButton} onPress={hide}>
          <Icon size={24} color="#ffffff" name="XIcon" />
        </TouchableOpacity>
        <Zoomable isDoubleTapEnabled isSingleTapEnabled onSingleTap={hide}>
          <Image
            source={{ uri: imageUriRef.current }}
            contentFit="contain"
            style={styles.fullScreenImage}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        </Zoomable>
        {/* Spinner sits above the image and disappears the moment
            expo-image fires `onLoad`. `onError` also clears it so a
            failed load doesn't leave the spinner stranded over a broken
            placeholder. */}
        {!loaded ? (
          <View pointerEvents="none" style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  overlayContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000000,
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(90, 90, 90, 0.95)",
  },
  overlayContent: {
    flex: 1,
    marginHorizontal: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 60,
    right: 16,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 22,
    zIndex: 100001,
  },
  closeIcon: {
    width: 24,
    height: 24,
    tintColor: "#FFFFFF",
  },
  fullScreenImage: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});

export function useImage(): ImageContextType {
  const context = useContext(ImageContext);
  if (!context) {
    throw new Error("useImage must be used within an ImageProvider");
  }
  return context;
}
