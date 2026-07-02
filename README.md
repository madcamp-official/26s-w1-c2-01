# 26s-w1-c2-01

## 공통과제 I : 웹 기반 프로젝트 (2인 1팀)

**목적:** 공통 과제를 함께 수행하며 웹 개발의 전체 흐름을 빠르게 익히고 협업에 적응하기

**결과물:** 기획부터 배포까지 완료된 웹 서비스와 관련 문서 일체

---

## 팀원

| 이름 | GitHub | 역할 |
|---|---|---|
|양우현|hyun020215|  |
|김경원|kkw610|  |

---

## 기획안

> 프로젝트 주제, 목적, 핵심 기능, 예상 사용자, 팀원별 역할 등 정리

- **주제:** 온라인 브레인스토밍 협업 툴
- **목적:** 웹 상에서 팀원들과 함께 자유롭게 의견을 나누고 브레인스토밍을 할 수 있도록 검색, 공유, 추천, 커스터마이징 등의 기능으로 사용자 보조.
- **핵심 기능:** 로그인, 워크스페이스 생성/공유, 아이디어 블록 생성/연결/삭제, 댓글, 자동 추천, 추천 우선순위 커스터마이징
- **예상 사용자:** Ideation이 필요한 학생, 직장인 등

---

## 기능 명세서

> 구현할 기능을 사용자 관점에서 정리하고, 필수 기능과 선택 기능을 구분

### 필수 기능

- [ ] 로그인
- [ ] 워크스페이스 생성
- [ ] 워크스페이스 공유/초대
- [ ] 아이디어 블록 생성/연결/삭제

### 선택 기능

- [ ] 자동 추천
- [ ] 댓글
- [ ] 추천 우선순위 커스터마이징

---

## IA 및 화면 설계서

> 서비스의 전체 페이지 구조와 페이지 간 이동 흐름; 각 페이지의 주요 UI 구성, 입력 요소, 버튼, 사용자 행동 흐름 등을 간단한 와이어프레임 형태로 정리

<!-- Figma 링크 또는 이미지 첨부 -->

---

## DB 스키마

> 필요한 테이블, 주요 필드, 데이터 타입, 테이블 간 관계를 정리

<!-- ERD 이미지 또는 테이블 정의 -->
### User
| userID | name | ID(unique) | password |

### Workspace
| workspaceID | name | creator(foreign key: userID) | userID(foreign key) |

### Block
| blockID | content | workspaceID | parent_block(NULLable) | created_datetime | updated_datetime |

### Comment
| commentID | content | author(foreign key) | workspaceID | solved |

---

## API 문서

> API 주소, 요청 방식, 요청값, 응답값, 에러 상황을 정리

| Method | Endpoint | 설명 | 요청 | 응답 |
|---|---|---|---|---|
| POST   | `/api/v1/auth/signup`                                      | 회원가입            | `id`, `password`, `name`                 | `userID`, `id`, `name`   |
| POST   | `/api/v1/auth/login`                                       | 로그인             | `id`, `password`                         | `accessToken`, `user`    |
| POST   | `/api/v1/auth/logout`                                      | 로그아웃            | 없음                                       | `message`                |
| GET    | `/api/v1/users/me`                                         | 내 정보 조회         | 없음                                       | `userID`, `id`, `name`   |
| POST   | `/api/v1/workspaces`                                       | 워크스페이스 생성       | `name`                                   | `workspace`              |
| GET    | `/api/v1/workspaces`                                       | 내 워크스페이스 목록 조회  | 없음                                       | `workspaces[]`           |
| GET    | `/api/v1/workspaces/{workspaceID}`                         | 워크스페이스 상세 조회    | 없음                                       | `workspace`, `members[]` |
| PATCH  | `/api/v1/workspaces/{workspaceID}`                         | 워크스페이스 수정       | `name`                                   | `workspace`              |
| DELETE | `/api/v1/workspaces/{workspaceID}`                         | 워크스페이스 삭제       | 없음                                       | `message`                |
| POST   | `/api/v1/workspaces/{workspaceID}/invite`                  | 워크스페이스 초대       | `id` 또는 `userID`                         | `invitation`             |
| GET    | `/api/v1/workspaces/{workspaceID}/members`                 | 멤버 목록 조회        | 없음                                       | `members[]`              |
| DELETE | `/api/v1/workspaces/{workspaceID}/members/{userID}`        | 멤버 제거           | 없음                                       | `message`                |
| GET    | `/api/v1/invitations`                                      | 내가 받은 초대 목록 조회  | 없음                                       | `invitations[]`          |
| POST   | `/api/v1/invitations/{invitationID}/accept`                | 초대 수락           | 없음                                       | `message`                |
| POST   | `/api/v1/invitations/{invitationID}/reject`                | 초대 거절           | 없음                                       | `message`                |
| POST   | `/api/v1/workspaces/{workspaceID}/blocks`                  | 아이디어 블록 생성      | `content`, `parentBlockID?`              | `block`                  |
| GET    | `/api/v1/workspaces/{workspaceID}/blocks`                  | 블록 목록 조회        | 없음                                       | `blocks[]`               |
| GET    | `/api/v1/blocks/{blockID}`                                 | 블록 상세 조회        | 없음                                       | `block`                  |
| PATCH  | `/api/v1/blocks/{blockID}`                                 | 블록 수정           | `content`                                | `block`                  |
| DELETE | `/api/v1/blocks/{blockID}`                                 | 블록 삭제           | 없음                                       | `message`                |
| PATCH  | `/api/v1/blocks/{blockID}/parent`                          | 블록 연결/부모 변경     | `parentBlockID` 또는 `null`                | `block`                  |
<!-- 이후부터 선택기능 -->
| POST   | `/api/v1/blocks/{blockID}/comments`                        | 댓글 작성           | `content`                                | `comment`                |
| GET    | `/api/v1/blocks/{blockID}/comments`                        | 댓글 목록 조회        | 없음                                       | `comments[]`             |
| PATCH  | `/api/v1/comments/{commentID}`                             | 댓글 수정           | `content`, `solved?`                     | `comment`                |
| DELETE | `/api/v1/comments/{commentID}`                             | 댓글 삭제           | 없음                                       | `message`                |
| PATCH  | `/api/v1/comments/{commentID}/solved`                      | 댓글 해결 여부 변경     | `solved`                                 | `comment`                |
| GET    | `/api/v1/workspaces/{workspaceID}/recommendations`         | 워크스페이스 기반 추천 조회 | `limit?`                                 | `recommendations[]`      |
| GET    | `/api/v1/blocks/{blockID}/recommendations`                 | 블록 기반 추천 조회     | `limit?`                                 | `recommendations[]`      |
| POST   | `/api/v1/workspaces/{workspaceID}/recommendations/apply`   | 추천을 블록으로 추가     | `content`, `parentBlockID?`              | `block`                  |
| GET    | `/api/v1/workspaces/{workspaceID}/recommendation-settings` | 추천 우선순위 설정 조회   | 없음                                       | `settings`               |
| PATCH  | `/api/v1/workspaces/{workspaceID}/recommendation-settings` | 추천 우선순위 설정 수정   | `creativity`, `feasibility`, `relevance` | `settings`               |


---

## 배포 결과물

> 접속 가능한 링크, 실행 방법, 주요 구현 내용

- **서비스 URL:**
- **실행 방법:**

```bash
# 실행 방법 작성
```

---

## 회고 문서

> 개발 과정에서의 어려움, 해결 방법, 역할 분담, 다음에 개선할 점 (KPT 방법론 참고)

### Keep

### Problem

### Try

---

## 참고 자료

- [SDD(스펙 주도 개발) 이해하기](https://news.hada.io/topic?id=21338)
- [Software Design Document Best Practices](https://www.atlassian.com/work-management/project-management/design-document)
- [IA 정보구조도 작성 방법](https://brunch.co.kr/@nyonyo/7)
- [기획자 화면설계서 작성법](https://brunch.co.kr/@soup/10)
- [Figma 와이어프레임 가이드](https://www.figma.com/ko-kr/resource-library/what-is-wireframing/)
- [무료 Figma 와이어프레임 키트](https://www.figma.com/ko-kr/templates/wireframe-kits/)
- [ERD/DB 설계 총정리](https://inpa.tistory.com/entry/DB-%F0%9F%93%9A-%EB%8D%B0%EC%9D%B4%ED%84%B0-%EB%AA%A8%EB%8D%B8%EB%A7%81-%EA%B0%9C%EB%85%90-ERD-%EB%8B%A4%EC%9D%B4%EC%96%B4%EA%B7%B8%EB%9E%A8)
- [API 명세서 작성 가이드라인](https://velog.io/@sebinChu/BackEnd-API-%EB%AA%85%EC%84%B8%EC%84%9C-%EC%9E%91%EC%84%B1-%EA%B0%80%EC%9D%B4%EB%93%9C-%EB%9D%BC%EC%9D%B8)
- [좋은 README 작성하는 방법](https://velog.io/@sabo/good-readme)
- [단기 프로젝트 회고 KPT 방법론](https://velog.io/@habwa/%EB%8B%A8%EA%B8%B0-%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8-%ED%9A%8C%EA%B3%A0-KPT-%EB%B0%A9%EB%B2%95%EB%A1%A0)
