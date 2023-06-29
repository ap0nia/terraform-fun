# step 1
FROM public.ecr.aws/lambda/nodejs:16 as builder
RUN npm i -g pnpm
WORKDIR /usr/app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm run build
    
# step 2
FROM public.ecr.aws/lambda/nodejs:16

# install terraform
RUN yum install -y yum-utils shadow-utils
RUN yum-config-manager --add-repo https://rpm.releases.hashicorp.com/AmazonLinux/hashicorp.repo
RUN yum -y install terraform

WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=builder /usr/app/dist/* ./
CMD ["index.handler"]
