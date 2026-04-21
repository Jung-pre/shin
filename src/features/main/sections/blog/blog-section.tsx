/* eslint-disable @next/next/no-img-element */
import type { BlogSectionMessages } from "@/shared/i18n/messages";
import styles from "./blog-section.module.css";

export interface BlogSectionProps {
  messages: BlogSectionMessages;
}

export function BlogSection({ messages }: BlogSectionProps) {
  return (
    <section className={styles.section} aria-labelledby="blog-section-heading">
      <div className={styles.inner}>
        <div className={styles.topGroup}>
          <div className={styles.leftColumn}>
            <p className={styles.eyebrow} lang="en">
            <img
              src="/main/img_main_blog_logo.png"
              alt=""
              className={styles.eyebrowLogo}
              aria-hidden="true"
              loading="lazy"
              decoding="async"
            />
            </p>
            <h2 id="blog-section-heading" className={styles.title}>
              <span>{messages.titlePrefix}</span>
              <span className={styles.titleAccent}>{messages.titleAccent}</span>
            </h2>
            <p className={styles.description}>{messages.description}</p>
            <a href={messages.ctaHref ?? "#"} className={styles.cta}>
              <span className={styles.ctaDot} aria-hidden />
              <span>{messages.ctaLabel}</span>
            </a>
          </div>

          <a href={messages.heroHref ?? "#"} className={styles.heroCard}>
            <img src={messages.heroImageSrc} alt={messages.heroTitle} className={styles.heroImage} loading="lazy" decoding="async" />
            <div className={styles.heroMeta}>
              <p className={styles.heroDate}>{messages.heroDate}</p>
              <p className={styles.heroTitle}>{messages.heroTitle}</p>
              <div className={styles.heroBottomRow}>
                <p className={styles.heroSource}>
                  <img
                    src="/main/img_main_blog_logo02.png"
                    alt=""
                    className={styles.heroSourceLogo}
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                  />
                  <span>{messages.heroSourceLabel}</span>
                </p>
                <div className={styles.heroActions} aria-hidden="true">
                  <span className={styles.commentBadge}>
                    <span className={styles.actionIcon}>
                      <CommentIcon />
                    </span>
                    <span>2 댓글</span>
                  </span>
                  <span className={styles.actionButtons}>
                    <span className={styles.actionCircle}>
                      <ShareIcon />
                    </span>
                    <span className={styles.actionCircle}>
                      <ArrowOutIcon />
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </a>
        </div>

        <div className={styles.bottomGroup}>
          <ul className={styles.postList}>
            {messages.posts.map((post) => (
              <li key={`${post.indexLabel}-${post.title}`} className={styles.postItem}>
                <div className={styles.postRow}>
                  <div className={styles.postMain}>
                    <span className={styles.postIndex}>{post.indexLabel}</span>
                    <div className={styles.postText}>
                      <p className={styles.postTitle}>{post.title}</p>
                      <p className={styles.postDate}>{post.date}</p>
                    </div>
                  </div>
                  <div className={styles.postThumbWrap}>
                    <img src={post.thumbnailSrc} alt={post.title} className={styles.postThumb} loading="lazy" decoding="async" />
                    <img
                      src="/main/img_main_blog_hover.png"
                      alt=""
                      className={styles.postThumbHover}
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className={styles.postPager}>
            {messages.posts.map((post) => (
              <a key={`pager-${post.indexLabel}`} href={post.href ?? "#"} className={styles.postPagerItem}>
                {post.indexLabel}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CommentIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3.83301 9.67871H11.4997V8.67871H3.83301V9.67871ZM3.83301 7.67871H11.4997V6.67871H3.83301V7.67871ZM3.83301 5.67871H11.4997V4.67871H3.83301V5.67871ZM13.9997 14.5377L11.6407 12.1787H2.53817C2.2014 12.1787 1.91634 12.062 1.68301 11.8287C1.44967 11.5954 1.33301 11.3103 1.33301 10.9735V3.38388C1.33301 3.0471 1.44967 2.76204 1.68301 2.52871C1.91634 2.29538 2.2014 2.17871 2.53817 2.17871H12.7945C13.1313 2.17871 13.4163 2.29538 13.6497 2.52871C13.883 2.76204 13.9997 3.0471 13.9997 3.38388V14.5377ZM2.53817 11.1787H12.0663L12.9997 12.1019V3.38388C12.9997 3.33254 12.9783 3.28554 12.9355 3.24288C12.8928 3.2001 12.8458 3.17871 12.7945 3.17871H2.53817C2.48684 3.17871 2.43984 3.2001 2.39717 3.24288C2.3544 3.28554 2.33301 3.33254 2.33301 3.38388V10.9735C2.33301 11.0249 2.3544 11.0719 2.39717 11.1145C2.43984 11.1573 2.48684 11.1787 2.53817 11.1787Z" fill="white" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M11.204 14.3337C10.705 14.3337 10.2813 14.1592 9.93299 13.8102C9.58477 13.4612 9.41066 13.0374 9.41066 12.5388C9.41066 12.4722 9.43371 12.3102 9.47983 12.0528L4.73883 9.26183C4.57816 9.42849 4.38727 9.55905 4.16616 9.65349C3.94505 9.74794 3.70816 9.79516 3.45549 9.79516C2.95871 9.79516 2.53644 9.61994 2.18866 9.26949C1.84088 8.91905 1.66699 8.49599 1.66699 8.00033C1.66699 7.50466 1.84088 7.0816 2.18866 6.73116C2.53644 6.38071 2.95871 6.20549 3.45549 6.20549C3.70816 6.20549 3.94505 6.25271 4.16616 6.34716C4.38727 6.4416 4.57816 6.57216 4.73883 6.73883L9.47983 3.95416C9.45338 3.87216 9.43521 3.79183 9.42533 3.71316C9.41555 3.63449 9.41066 3.55071 9.41066 3.46183C9.41066 2.96327 9.58527 2.53949 9.93449 2.19049C10.2838 1.84149 10.708 1.66699 11.207 1.66699C11.706 1.66699 12.1296 1.84166 12.4778 2.19099C12.8262 2.54021 13.0003 2.96433 13.0003 3.46333C13.0003 3.96233 12.8258 4.38599 12.4768 4.73433C12.1278 5.08255 11.704 5.25666 11.2055 5.25666C10.9516 5.25666 10.7155 5.20838 10.4972 5.11183C10.2787 5.01527 10.0892 4.88366 9.92849 4.71699L5.18749 7.50799C5.21394 7.5901 5.2321 7.67044 5.24199 7.74899C5.25177 7.82766 5.25666 7.91144 5.25666 8.00033C5.25666 8.08921 5.25177 8.17299 5.24199 8.25166C5.2321 8.33021 5.21394 8.41055 5.18749 8.49266L9.92849 11.2837C10.0892 11.117 10.2787 10.9854 10.4972 10.8888C10.7155 10.7923 10.9516 10.744 11.2055 10.744C11.704 10.744 12.1278 10.9186 12.4768 11.2678C12.8258 11.6172 13.0003 12.0413 13.0003 12.5403C13.0003 13.0393 12.8257 13.4629 12.4763 13.8112C12.1271 14.1595 11.703 14.3337 11.204 14.3337Z" fill="white" />
    </svg>
  );
}

function ArrowOutIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M11.3334 5.36949L4.05388 12.649C3.96154 12.7413 3.84554 12.7885 3.70588 12.7907C3.5661 12.7928 3.44793 12.7455 3.35138 12.649C3.25482 12.5524 3.20654 12.4354 3.20654 12.2978C3.20654 12.1602 3.25482 12.043 3.35138 11.9465L10.6309 4.66699H6.50004C6.35838 4.66699 6.2396 4.61905 6.14371 4.52316C6.04793 4.42727 6.00004 4.30849 6.00004 4.16683C6.00004 4.02505 6.04793 3.90633 6.14371 3.81066C6.2396 3.71488 6.35838 3.66699 6.50004 3.66699H11.7307C11.9015 3.66699 12.0446 3.72477 12.16 3.84033C12.2756 3.95577 12.3334 4.09888 12.3334 4.26966V9.50033C12.3334 9.64199 12.2854 9.76077 12.1895 9.85666C12.0937 9.95244 11.9749 10.0003 11.8332 10.0003C11.6914 10.0003 11.5727 9.95244 11.477 9.85666C11.3813 9.76077 11.3334 9.64199 11.3334 9.50033V5.36949Z" fill="white" />
    </svg>
  );
}
