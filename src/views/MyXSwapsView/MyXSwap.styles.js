import styled from "styled-components";

export const Wrapper = styled.div`
display: grid;
grid-template-columns: 1fr 3fr;
grid-column-gap: 10px;
align-items: center;
padding: 5px 5px;
color: var(--highLightColor);

.transactions {
  display: flex;
  flex-direction: column;
}

.openJobs {
  display: flex;
  flex-direction: column;
  height: 500px;
}

.chainButtons {
    align-self: center;
    display: flex;
  }

h2 {
  margin: 0 0 10px 10px;
}

@media (max-width: 1000px) {
  grid-template-columns: 1fr;
  grid-row-gap: 10px;
}
`;