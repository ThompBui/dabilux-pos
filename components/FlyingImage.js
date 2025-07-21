// components/FlyingImage.js
import React, { useState, useEffect } from 'react';
import Image from 'next/image';

// Component này sẽ là hình ảnh "bản sao" bay trên màn hình
const FlyingImage = ({ src, startRect, endRect, onAnimationEnd }) => {
  const [style, setStyle] = useState({
    position: 'fixed',
    left: `${startRect.left + startRect.width / 2}px`,
    top: `${startRect.top + startRect.height / 2}px`,
    width: `${startRect.width}px`,
    height: `${startRect.height}px`,
    transform: 'translate(-50%, -50%) scale(1)',
    borderRadius: '0.5rem',
    objectFit: 'cover',
    opacity: 1,
    transition: 'all 0.6s cubic-bezier(0.5, 0, 1, 0.5)', // Hiệu ứng bay cong
    zIndex: 9999,
  });

  useEffect(() => {
    // Ngay sau khi component được render, chúng ta cập nhật style để bắt đầu animation
    const timeoutId = setTimeout(() => {
      setStyle(prevStyle => ({
        ...prevStyle,
        left: `${endRect.left + endRect.width / 2}px`,
        top: `${endRect.top + endRect.height / 2}px`,
        opacity: 0,
        transform: 'translate(-50%, -50%) scale(0.1)', // Thu nhỏ và bay tới
      }));
    }, 10); // Đợi một chút để trình duyệt kịp render trạng thái ban đầu

    // Sau khi animation kết thúc (600ms), gọi callback để xóa component này
    const endTimeoutId = setTimeout(onAnimationEnd, 600);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(endTimeoutId);
    };
  }, [src, startRect, endRect, onAnimationEnd]); // Chỉ chạy 1 lần

  return (
    <Image 
      src={src} 
      alt="Flying product" 
      width={startRect.width} 
      height={startRect.height} 
      style={style} 
      unoptimized // Cần thiết để src hoạt động với mọi URL
    />
  );
};

export default FlyingImage;