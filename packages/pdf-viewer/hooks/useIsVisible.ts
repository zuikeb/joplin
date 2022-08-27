import React, { useEffect, useState } from 'react';


const useIsVisible = (elementRef: React.MutableRefObject<HTMLElement>, rootRef: React.MutableRefObject<HTMLElement>) => {
	const [isVisible, setIsVisible] = useState(false);
	useEffect(() => {
		let observer: IntersectionObserver = null;
		if (elementRef.current) {
			observer = new IntersectionObserver((entries, _observer) => {
				let visible = false;
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						visible = true;
						setIsVisible(true);
					}
				});
				if (!visible) {
					setIsVisible(false);
				}
			}, {
				root: rootRef.current,
				rootMargin: '0px 0px 0px 0px',
				threshold: 0,
			});
			observer.observe(elementRef.current);
		}
		return () => {
			if (observer) {
				observer.disconnect();
			}
		};
		// eslint-disable-next-line @seiyab/react-hooks/exhaustive-deps -- Old code before rule was applied
	}, []);

	return isVisible;
};

export default useIsVisible;
