import { Image as ExpoImage, type ImageProps } from "expo-image";
import { withUniwind } from "uniwind";

// 1. Wrap the base Image component with Uniwind functionality
const UniwindImage = withUniwind(ExpoImage);

// 2. Define types to include both expo-image props AND uniwind's className
interface StyledImageProps extends ImageProps {
  className?: string;
}

/**
 * A reusable Image component powered by expo-image and Uniwind.
 * Supports all standard expo-image props plus Tailwind classes.
 */
const Image = ({
  className,
  style,
  contentFit = "cover",
  transition = 200,
  source,
  ...props
}: StyledImageProps) => {
  return (
    <UniwindImage
      className={className}
      style={style}
      contentFit={contentFit}
      transition={transition}
      source={source}
      // Spread the rest of the props (source, placeholder, etc.)
      {...props}
    />
  );
};

export default Image;
